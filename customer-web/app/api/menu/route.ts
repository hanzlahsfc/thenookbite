import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdminApi } from '@/lib/admin-auth';

export async function POST(req: NextRequest) {
  const authErr = await requireAdminApi();
  if (authErr) return authErr;

  const body = await req.json();
  const { name, category, price, description, sku } = body;

  if (!name?.trim() || !category || !price) {
    return NextResponse.json({ detail: 'name, category and price are required' }, { status: 400 });
  }

  const db = createServiceClient();

  // Auto-generate SKU if not provided
  const resolvedSku = sku?.trim() || `${category.toUpperCase().replace(/\s+/g, '-')}-${Date.now()}`;

  const { data, error } = await db
    .from('menu_items')
    .insert({
      name: name.trim(),
      category,
      price: parseInt(price),
      description: description?.trim() || null,
      sku: resolvedSku,
      available: true,
      sort_order: 9999,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category');
  const db = createServiceClient();

  let query = db.from('menu_items').select('*').eq('available', true).order('sort_order');
  if (category) query = query.eq('category', category);

  const { data, error } = await query;
  if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
  return NextResponse.json(data);
}
