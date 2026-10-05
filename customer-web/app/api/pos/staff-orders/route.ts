import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createClient } from '@/lib/supabase/server';

/**
 * Orders placed during the current POS shift. Filtered by session_id, not
 * staff_id — the admin/owner account has no row in the `staff` table (its
 * orders are inserted with staff_id: null to satisfy the orders_staff_id_fkey
 * constraint), so a staff_id filter always came back empty when the owner
 * ran the till themselves. session_id is set on every order regardless of
 * who placed it, so it's the one field that reliably identifies "this shift".
 */
export async function GET(req: NextRequest) {
  const sessionClient = createClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });

  const sessionId = req.nextUrl.searchParams.get('session_id');
  if (!sessionId) return NextResponse.json({ detail: 'session_id required' }, { status: 400 });

  const db = createServiceClient();

  const { data, error } = await db
    .from('orders')
    .select('id, order_number, customer_name, customer_phone, total, order_type, table_number, delivery_address, rider_name, delivery_charge, tip, payment_method, payment_status, status, special_notes, created_at, session_id, order_items(id, item_name, item_price, quantity)')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
