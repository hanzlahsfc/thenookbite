import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdminApi } from '@/lib/admin-auth';
import { getCategoryNames } from '@/lib/menuCategories';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const authErr = await requireAdminApi();
  if (authErr) return authErr;

  const body = await req.json();
  const db = createServiceClient();

  const allowed = ['name', 'description', 'price', 'image_url', 'deal_price', 'deal_label', 'available', 'category'];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  if ('category' in update) {
    const names = await getCategoryNames();
    if (typeof update.category !== 'string' || !names.includes(update.category)) {
      return NextResponse.json(
        { detail: `Unknown category. Pick one of: ${names.join(', ')}` },
        { status: 400 },
      );
    }
  }

  const { data, error } = await db
    .from('menu_items')
    .update(update)
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const authErr = await requireAdminApi();
  if (authErr) return authErr;
  const db = createServiceClient();

  const { error } = await db.from('menu_items').delete().eq('id', params.id);
  if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
