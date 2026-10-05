import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdminApi } from '@/lib/admin-auth';
import { getCashSnapshot } from '@/lib/cashDrawer';

export const dynamic = 'force-dynamic';

/**
 * Record cash paid into or out of the drawer between resets — taking money to
 * the bank, paying a supplier in cash, topping the float up. Unlike a reset it
 * does not close the counting period; the sale total keeps accumulating.
 */
export async function POST(req: NextRequest) {
  const authErr = await requireAdminApi();
  if (authErr) return authErr;

  const body = await req.json().catch(() => ({}));
  const amount    = Math.round(Number(body.amount) || 0);
  const direction = body.direction === 'in' ? 'in' : body.direction === 'out' ? 'out' : null;
  const reason    = typeof body.reason === 'string' ? body.reason.trim() : '';

  if (!direction) {
    return NextResponse.json({ detail: 'direction must be "in" or "out"' }, { status: 400 });
  }
  if (amount <= 0) {
    return NextResponse.json({ detail: 'Amount must be greater than zero' }, { status: 400 });
  }

  // Don't let the drawer go negative — that always means a typo
  const before = await getCashSnapshot();
  if (direction === 'out' && amount > before.expectedInDrawer) {
    return NextResponse.json({
      detail: `Only ${before.expectedInDrawer} in the drawer — cannot take out ${amount}.`,
    }, { status: 400 });
  }

  const db = createServiceClient();
  const { error } = await db.from('cash_movements').insert({
    amount,
    direction,
    reason: reason || null,
    created_by: 'admin',
  });

  if (error) return NextResponse.json({ detail: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, snapshot: await getCashSnapshot() });
}

// Undo a movement recorded by mistake
export async function DELETE(req: NextRequest) {
  const authErr = await requireAdminApi();
  if (authErr) return authErr;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ detail: 'id required' }, { status: 400 });

  const db = createServiceClient();
  const { error } = await db.from('cash_movements').delete().eq('id', id);
  if (error) return NextResponse.json({ detail: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, snapshot: await getCashSnapshot() });
}
