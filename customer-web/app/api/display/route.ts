import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Public endpoint — no auth required. Returns only preparing/ready orders for the customer display screen.
export async function GET() {
  const db = createServiceClient();

  // Same window and verified check the kitchen uses. Without them the board
  // kept showing orders the kitchen had long since dropped: an order left in
  // "preparing" and never marked ready sat on the customer screen indefinitely,
  // so numbers from two days earlier were still listed as being prepared.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await db
    .from('orders')
    .select('id, order_number, customer_name, table_number, status, created_at')
    .in('status', ['preparing', 'ready'])
    .eq('verified', true)
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
  return NextResponse.json(data ?? [], {
    headers: { 'Cache-Control': 'no-store' },
  });
}

// Mark a ready order as collected (completed). Called from the order-status display screen.
export async function PATCH(req: NextRequest) {
  const { id } = await req.json() as { id: string };
  if (!id) return NextResponse.json({ detail: 'id required' }, { status: 400 });

  const db = createServiceClient();
  const { error } = await db
    .from('orders')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'ready');

  if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
