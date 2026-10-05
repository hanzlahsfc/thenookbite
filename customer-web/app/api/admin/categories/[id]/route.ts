import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdminApi } from '@/lib/admin-auth';

/**
 * PATCH — rename, relabel, reorder or re-image a category.
 *
 * A rename must move the category row AND every menu item under it. That runs
 * through the rename_menu_category() function so it is one transaction: a
 * half-applied rename would strand every item in a category that no longer
 * exists, and they would vanish from the menu.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const authErr = await requireAdminApi();
  if (authErr) return authErr;

  const body = await req.json();
  const db = createServiceClient();

  const { data: current, error: readErr } = await db
    .from('menu_categories').select('*').eq('id', params.id).single();
  if (readErr || !current) {
    return NextResponse.json({ detail: 'Category not found' }, { status: 404 });
  }

  // Rename first — it touches menu_items too
  if (typeof body.name === 'string' && body.name.trim() && body.name.trim() !== current.name) {
    const nextName = body.name.trim();
    const { error: renameErr } = await db.rpc('rename_menu_category', {
      p_old: current.name,
      p_new: nextName,
    });
    if (renameErr) {
      return NextResponse.json({ detail: renameErr.message }, { status: 400 });
    }
  }

  const update: Record<string, unknown> = {};
  if ('display_label' in body) update.display_label = body.display_label?.trim() || null;
  if ('image_url' in body)     update.image_url     = body.image_url?.trim() || null;
  if (typeof body.sort_order === 'number') update.sort_order = body.sort_order;

  if (Object.keys(update).length > 0) {
    const { error } = await db.from('menu_categories').update(update).eq('id', params.id);
    if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
  }

  const { data: fresh } = await db.from('menu_categories').select('*').eq('id', params.id).single();
  return NextResponse.json(fresh);
}

/**
 * DELETE — remove a category.
 *
 * Refused while items still use it, unless ?reassign_to=<name> is given, in
 * which case those items are moved first. Deleting with items behind it would
 * leave them referencing a category that no longer exists.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const authErr = await requireAdminApi();
  if (authErr) return authErr;

  const db = createServiceClient();
  const reassignTo = req.nextUrl.searchParams.get('reassign_to');

  const { data: cat } = await db
    .from('menu_categories').select('*').eq('id', params.id).single();
  if (!cat) return NextResponse.json({ detail: 'Category not found' }, { status: 404 });

  const { count } = await db
    .from('menu_items')
    .select('id', { count: 'exact', head: true })
    .eq('category', cat.name);

  const itemCount = count ?? 0;

  if (itemCount > 0) {
    if (!reassignTo) {
      return NextResponse.json({
        detail: `"${cat.name}" still has ${itemCount} item${itemCount === 1 ? '' : 's'}. Move them to another category first.`,
        item_count: itemCount,
      }, { status: 409 });
    }

    const { data: target } = await db
      .from('menu_categories').select('name').eq('name', reassignTo).maybeSingle();
    if (!target) {
      return NextResponse.json({ detail: `No category named "${reassignTo}"` }, { status: 400 });
    }

    const { error: moveErr } = await db
      .from('menu_items').update({ category: target.name }).eq('category', cat.name);
    if (moveErr) return NextResponse.json({ detail: moveErr.message }, { status: 500 });
  }

  const { error } = await db.from('menu_categories').delete().eq('id', params.id);
  if (error) return NextResponse.json({ detail: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, moved: itemCount > 0 ? itemCount : 0 });
}
