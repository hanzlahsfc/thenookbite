import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionClient = createClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });

  const db = createServiceClient();
  const { data, error } = await db
    .from('orders')
    .select('id, customer_name, customer_phone, total, order_type, table_number, delivery_address, payment_method, special_notes, created_at, order_items(item_name, item_price, quantity)')
    .eq('session_id', params.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
