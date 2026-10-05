import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createClient } from '@/lib/supabase/server';

interface IncomingItem {
  menu_item_id?: string | null;
  item_name: string;
  item_price: number;
  quantity: number;
}

/**
 * POST /api/orders/{id}/items — add items to an existing unpaid order.
 *
 * Lets the counter extend an order the customer is still adding to, instead of
 * opening a second bill. Only unpaid orders qualify: adding to a settled one
 * would mean collecting more money, which is a different flow.
 *
 * The new total is the old total plus the added items, rather than a recompute
 * from scratch — the discount that produced the original total is not stored on
 * the order, so recomputing would silently drop it.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionClient = createClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });

  const { items } = (await req.json()) as { items?: IncomingItem[] };
  if (!items?.length) {
    return NextResponse.json({ detail: 'No items to add' }, { status: 400 });
  }

  const db = createServiceClient();

  const { data: order, error: readErr } = await db
    .from('orders')
    .select('id, order_number, total, status, payment_status')
    .eq('id', params.id)
    .single();

  if (readErr || !order) {
    return NextResponse.json({ detail: 'Order not found' }, { status: 404 });
  }
  if (order.status === 'cancelled') {
    return NextResponse.json({ detail: 'This order was cancelled' }, { status: 409 });
  }
  if (order.payment_status === 'paid') {
    return NextResponse.json(
      { detail: `Order #${order.order_number} is already paid. Take a new order instead.` },
      { status: 409 },
    );
  }

  const added = items.reduce((s, i) => s + Math.round(i.item_price) * Math.round(i.quantity), 0);
  if (added <= 0) {
    return NextResponse.json({ detail: 'Items must have a price and quantity' }, { status: 400 });
  }

  const { error: itemsErr } = await db.from('order_items').insert(
    items.map(i => ({
      order_id: order.id,
      menu_item_id: i.menu_item_id || null,
      item_name: i.item_name,
      item_price: Math.round(i.item_price),
      quantity: Math.round(i.quantity),
    })),
  );
  if (itemsErr) return NextResponse.json({ detail: itemsErr.message }, { status: 500 });

  const newTotal = (order.total ?? 0) + added;

  const { data: updated, error: updErr } = await db
    .from('orders')
    .update({ total: newTotal, updated_at: new Date().toISOString() })
    .eq('id', order.id)
    .select('*, order_items(item_name, item_price, quantity)')
    .single();

  if (updErr) {
    // Roll the items back so the bill never shows food the total does not cover
    await db.from('order_items').delete().eq('order_id', order.id).in('item_name', items.map(i => i.item_name));
    return NextResponse.json({ detail: updErr.message }, { status: 500 });
  }

  // Deduct stock for the added items, same as order creation. Never block on it.
  try {
    const menuItemIds = items.map(i => i.menu_item_id).filter(Boolean) as string[];
    if (menuItemIds.length) {
      const { data: recipes } = await db
        .from('recipes')
        .select('ingredient_id, quantity, menu_item_id')
        .in('menu_item_id', menuItemIds);

      if (recipes?.length) {
        const deductions: Record<string, number> = {};
        for (const item of items) {
          if (!item.menu_item_id) continue;
          for (const r of recipes.filter(r => r.menu_item_id === item.menu_item_id)) {
            deductions[r.ingredient_id] = (deductions[r.ingredient_id] ?? 0) + r.quantity * item.quantity;
          }
        }
        for (const [ingredientId, amount] of Object.entries(deductions)) {
          const { data: newQty } = await db.rpc('deduct_ingredient_stock', {
            p_ingredient_id: ingredientId,
            p_amount: amount,
          });
          if (newQty !== null) {
            await db.from('stock_movements').insert({
              ingredient_id: ingredientId,
              qty_change: -amount,
              reason: 'order',
              order_id: order.id,
            });
          }
        }
      }
    }
  } catch {
    // Stock accounting must never fail the edit
  }

  return NextResponse.json({ ok: true, added, order: updated });
}

/**
 * DELETE /api/orders/{id}/items?item_id=... — remove one line from an unpaid
 * order, for when the customer changes their mind before paying.
 *
 * Unpaid only, same as adding: money has not changed hands yet. The last line
 * cannot be removed — an order with nothing in it should be cancelled instead,
 * which keeps it in the record rather than leaving an empty bill.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionClient = createClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });

  const itemId = req.nextUrl.searchParams.get('item_id');
  if (!itemId) return NextResponse.json({ detail: 'item_id required' }, { status: 400 });

  const db = createServiceClient();

  const { data: order } = await db
    .from('orders')
    .select('id, order_number, total, status, payment_status, order_items(id, item_name, item_price, quantity)')
    .eq('id', params.id)
    .single();

  if (!order) return NextResponse.json({ detail: 'Order not found' }, { status: 404 });
  if (order.status === 'cancelled') {
    return NextResponse.json({ detail: 'This order was cancelled' }, { status: 409 });
  }
  if (order.payment_status === 'paid') {
    return NextResponse.json(
      { detail: `Order #${order.order_number} is already paid, so items cannot be removed.` },
      { status: 409 },
    );
  }

  const items = order.order_items ?? [];
  const line = items.find(i => i.id === itemId);
  if (!line) return NextResponse.json({ detail: 'Item not on this order' }, { status: 404 });

  if (items.length === 1) {
    return NextResponse.json(
      { detail: 'That is the only item left. Cancel the order instead of emptying it.' },
      { status: 409 },
    );
  }

  const { error: delErr } = await db.from('order_items').delete().eq('id', itemId);
  if (delErr) return NextResponse.json({ detail: delErr.message }, { status: 500 });

  // Mirror the add path: adjust the stored total rather than recomputing, since
  // the discount that produced it is not kept on the order.
  const removed = (line.item_price ?? 0) * (line.quantity ?? 0);
  const newTotal = Math.max(0, (order.total ?? 0) - removed);

  const { data: updated, error: updErr } = await db
    .from('orders')
    .update({ total: newTotal, updated_at: new Date().toISOString() })
    .eq('id', order.id)
    .select('*, order_items(id, item_name, item_price, quantity)')
    .single();

  if (updErr) return NextResponse.json({ detail: updErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, removed, order: updated });
}
