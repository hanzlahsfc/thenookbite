import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createClient } from '@/lib/supabase/server';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = createServiceClient();
  const { data, error } = await db
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', params.id)
    .single();

  if (error) return NextResponse.json({ detail: 'Order not found' }, { status: 404 });
  return NextResponse.json(data);
}

const VALID_ORDER_TYPES = new Set(['dine-in', 'takeaway', 'delivery']);

/**
 * PATCH /api/orders/{id} — edit an unpaid order's own fields: who it's for,
 * where it's going, delivery charge, tip, and notes. Items are handled
 * separately by /api/orders/{id}/items, since changing them also has to move
 * money — this route never touches order_items.
 *
 * Only unpaid orders qualify, same as the items route: editing a settled bill
 * would mean money already changed hands against different numbers.
 *
 * delivery_charge and tip move the order's total directly, so they're applied
 * as a delta against the CURRENT total (read fresh here) rather than by
 * recomputing from items — the discount that produced the original total is
 * not stored on the order, and a recompute would silently drop it. Any items
 * added or removed in the same edit should already have been sent to the
 * items route first, so the total this delta builds on is up to date.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionClient = createClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const db = createServiceClient();

  const { data: order, error: readErr } = await db
    .from('orders')
    .select('id, order_number, total, status, payment_status, delivery_charge, tip')
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
      { detail: `Order #${order.order_number} is already paid, so it cannot be edited.` },
      { status: 409 },
    );
  }

  const nextOrderType = VALID_ORDER_TYPES.has(body.order_type) ? body.order_type : 'dine-in';

  const nextDeliveryCharge = nextOrderType === 'delivery'
    ? Math.max(0, Math.round(Number(body.delivery_charge) || 0))
    : 0;
  const nextTip = Math.max(0, Math.round(Number(body.tip) || 0));

  const deliveryDelta = nextDeliveryCharge - (order.delivery_charge ?? 0);
  const tipDelta = nextTip - (order.tip ?? 0);

  const update = {
    customer_name:    (typeof body.customer_name === 'string' && body.customer_name.trim()) || 'Guest',
    customer_phone:   body.customer_phone || null,
    table_number:     nextOrderType === 'dine-in' ? (body.table_number || null) : null,
    delivery_address: nextOrderType === 'delivery' ? (body.delivery_address || null) : null,
    rider_name:       nextOrderType === 'delivery' ? (body.rider_name || null) : null,
    order_type:       nextOrderType,
    delivery_charge:  nextDeliveryCharge,
    tip:              nextTip,
    special_notes:    body.special_notes || null,
    total:            Math.max(0, (order.total ?? 0) + deliveryDelta + tipDelta),
    updated_at:       new Date().toISOString(),
  };

  const { data: updated, error: updErr } = await db
    .from('orders')
    .update(update)
    .eq('id', order.id)
    .select('*, order_items(id, item_name, item_price, quantity)')
    .single();

  if (updErr) return NextResponse.json({ detail: updErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, order: updated });
}
