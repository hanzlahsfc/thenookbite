import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdminApi } from '@/lib/admin-auth';
import { POS_ROLES, NON_POS_ROLES, ALL_ROLES } from '@/lib/staffRoles';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const authErr = await requireAdminApi();
  if (authErr) return authErr;

  const body = await req.json();
  const db = createServiceClient();

  // staff_type belongs here — without it, switching a member to non-POS silently
  // did nothing (the field was dropped before the update ever reached Postgres).
  const allowed = ['full_name', 'role', 'staff_type', 'phone', 'is_active', 'pin'];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  if ('role' in update && !ALL_ROLES.includes(update.role as string)) {
    return NextResponse.json({ detail: `Unknown role: ${update.role}` }, { status: 400 });
  }
  if ('staff_type' in update && !['pos', 'non-pos'].includes(update.staff_type as string)) {
    return NextResponse.json({ detail: 'staff_type must be pos or non-pos' }, { status: 400 });
  }

  // Keep role and staff_type consistent: a POS login needs a POS role.
  if ('staff_type' in update || 'role' in update) {
    const { data: current } = await db
      .from('staff').select('role, staff_type').eq('id', params.id).single();

    const nextType = (update.staff_type ?? current?.staff_type) as string;
    const nextRole = (update.role ?? current?.role) as string;
    const valid: readonly string[] = nextType === 'pos' ? POS_ROLES : NON_POS_ROLES;

    if (nextRole && !valid.includes(nextRole)) {
      return NextResponse.json(
        { detail: `"${nextRole}" is not a ${nextType} role. Pick one of: ${valid.join(', ')}` },
        { status: 400 },
      );
    }
  }

  const { data, error } = await db
    .from('staff')
    .update(update)
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ detail: error.message }, { status: 500 });

  // If deactivating, kill their auth session immediately
  if (body.is_active === false) {
    await db.auth.admin.signOut(params.id, 'others');
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/admin/staff/{id}
 *   default      -> deactivate (order history and attendance preserved)
 *   ?hard=true   -> permanently delete the account
 *
 * A hard delete removes the auth user, which cascades to the staff row and from
 * there to attendance records and POS sessions. Orders survive with staff_id
 * nulled (ON DELETE SET NULL), so sales history and totals are unaffected.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const authErr = await requireAdminApi();
  if (authErr) return authErr;

  const db = createServiceClient();
  const hard = req.nextUrl.searchParams.get('hard') === 'true';

  // Always cut the session first
  await db.auth.admin.signOut(params.id, 'others');

  if (!hard) {
    const { error } = await db.from('staff').update({ is_active: false }).eq('id', params.id);
    if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, deleted: false });
  }

  // Deleting the auth user cascades to staff -> attendance / pos_sessions
  const { error: authErr2 } = await db.auth.admin.deleteUser(params.id);
  if (authErr2) return NextResponse.json({ detail: authErr2.message }, { status: 500 });

  // Belt and braces: drop the staff row if no cascade was configured
  await db.from('staff').delete().eq('id', params.id);

  return NextResponse.json({ ok: true, deleted: true });
}
