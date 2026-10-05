import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdminApi } from '@/lib/admin-auth';
import { pkDate } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

export async function GET() {
  const authErr = await requireAdminApi();
  if (authErr) return authErr;

  const db = createServiceClient();
  // Use PKT midnight so Vercel (UTC) doesn't cut off early-morning Pakistan orders
  const todayPKT = pkDate(); // YYYY-MM-DD in Asia/Karachi
  const fromISO = `${todayPKT}T00:00:00+05:00`;

  // Today's orders with items and staff (exclude cancelled)
  const { data: orders } = await db
    .from('orders')
    .select('id, order_number, status, total, created_at, staff_id, source')
    .neq('status', 'cancelled')
    .gte('created_at', fromISO)
    .order('created_at', { ascending: false });

  // Items sold today (exclude cancelled orders)
  const { data: items } = await db
    .from('order_items')
    .select('quantity, orders!inner(created_at, status)')
    .gte('orders.created_at', fromISO)
    .neq('orders.status', 'cancelled');

  const itemsSold = (items ?? []).reduce((s: number, i: { quantity: number }) => s + i.quantity, 0);

  // Staff stats — count orders per staff_id today
  const allOrders = orders ?? [];
  const staffMap: Record<string, number> = {};
  let adminOrderCount = 0;

  for (const o of allOrders) {
    const src = (o as { source?: string; user_id?: string | null }).source;
    if (o.staff_id) {
      // Regular staff POS order
      staffMap[o.staff_id] = (staffMap[o.staff_id] ?? 0) + 1;
    } else if (src !== 'online') {
      // Admin POS orders: no staff_id and not an online customer order
      adminOrderCount++;
    }
  }

  const staffIds = Object.keys(staffMap);
  let staffStats: { staff_id: string; name: string; count: number }[] = [];

  if (staffIds.length > 0) {
    const { data: staffRows } = await db
      .from('staff')
      .select('id, full_name')
      .in('id', staffIds);

    for (const id of staffIds) {
      const staffRow = staffRows?.find(s => s.id === id);
      if (staffRow) {
        staffStats.push({ staff_id: id, name: staffRow.full_name, count: staffMap[id] });
      } else {
        // ID not in staff table → this was an admin order (old data before FK fix)
        adminOrderCount += staffMap[id];
      }
    }
  }

  // Add admin entry if they placed any POS orders today
  if (adminOrderCount > 0) {
    staffStats.push({ staff_id: 'admin', name: 'Admin', count: adminOrderCount });
  }
  staffStats.sort((a, b) => b.count - a.count);

  // Low stock ingredients
  const { data: allIngredients } = await db
    .from('ingredients')
    .select('id, name, unit, stock_qty, low_stock_threshold');

  const lowStock = (allIngredients ?? []).filter(i => i.stock_qty <= i.low_stock_threshold);

  // Today's profit
  const todayISO = todayPKT; // already YYYY-MM-DD in PKT
  const [purchasesRes, expensesRes] = await Promise.all([
    db.from('purchases').select('amount').eq('purchase_date', todayISO),
    db.from('expenses').select('amount').eq('expense_date', todayISO),
  ]);

  const todayRevenue   = allOrders.filter(o => o.status === 'completed').reduce((s, o) => s + (o.total ?? 0), 0);
  const todayPurchases = (purchasesRes.data ?? []).reduce((s, p) => s + (p.amount ?? 0), 0);
  const todayExpenses  = (expensesRes.data ?? []).reduce((s, e) => s + (e.amount ?? 0), 0);
  const todayProfit    = todayRevenue - todayPurchases - todayExpenses;

  return NextResponse.json({ orders: allOrders, staffStats, itemsSold, lowStock, todayProfit });
}
