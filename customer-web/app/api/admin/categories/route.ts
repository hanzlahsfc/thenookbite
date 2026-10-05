import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdminApi } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

// GET — categories with a live item count
export async function GET() {
  const authErr = await requireAdminApi();
  if (authErr) return authErr;

  const db = createServiceClient();
  const [{ data: cats, error }, { data: items }] = await Promise.all([
    db.from('menu_categories').select('*').order('sort_order'),
    db.from('menu_items').select('category'),
  ]);
  if (error) return NextResponse.json({ detail: error.message }, { status: 500 });

  const counts = new Map<string, number>();
  for (const i of items ?? []) counts.set(i.category, (counts.get(i.category) ?? 0) + 1);

  return NextResponse.json(
    (cats ?? []).map(c => ({ ...c, item_count: counts.get(c.name) ?? 0 })),
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

// POST — add a category
export async function POST(req: NextRequest) {
  const authErr = await requireAdminApi();
  if (authErr) return authErr;

  const { name, display_label, image_url } = await req.json();
  const clean = typeof name === 'string' ? name.trim() : '';
  if (!clean) return NextResponse.json({ detail: 'Name is required' }, { status: 400 });

  const db = createServiceClient();

  const { data: existing } = await db
    .from('menu_categories').select('id').ilike('name', clean).maybeSingle();
  if (existing) {
    return NextResponse.json({ detail: `"${clean}" already exists` }, { status: 409 });
  }

  const { data: last } = await db
    .from('menu_categories').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();

  const { data, error } = await db
    .from('menu_categories')
    .insert({
      name: clean,
      display_label: display_label?.trim() || null,
      image_url: image_url?.trim() || null,
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
  return NextResponse.json({ ...data, item_count: 0 }, { status: 201 });
}
