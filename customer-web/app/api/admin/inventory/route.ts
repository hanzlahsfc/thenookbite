import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdminApi } from '@/lib/admin-auth';

export async function GET() {
  const authErr = await requireAdminApi();
  if (authErr) return authErr;

  const db = createServiceClient();
  const { data, error } = await db
    .from('ingredients')
    .select('id, name, unit, stock_qty, low_stock_threshold, updated_at')
    .order('name');

  if (error) return NextResponse.json({ detail: error.message }, { status: 500 });

  // Tag each ingredient as low_stock
  const enriched = (data ?? []).map(i => ({
    ...i,
    low_stock: i.stock_qty <= i.low_stock_threshold,
  }));

  return NextResponse.json(enriched);
}
