import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdminApi } from '@/lib/admin-auth';
import { getCashSnapshot } from '@/lib/cashDrawer';

export const dynamic = 'force-dynamic';

export async function GET() {
  const authErr = await requireAdminApi();
  if (authErr) return authErr;

  return NextResponse.json(await getCashSnapshot(), {
    headers: { 'Cache-Control': 'no-store' },
  });
}

/**
 * Reset the drawer.
 *
 * Records the cash taken out (everything since the PREVIOUS reset — the old
 * code measured from midnight, so resetting twice in a day logged the same
 * amount again) and the float being left in the drawer, which the next count
 * starts from.
 */
export async function POST(req: NextRequest) {
  const authErr = await requireAdminApi();
  if (authErr) return authErr;

  const body = await req.json().catch(() => ({}));
  const openingBalance = Math.max(0, Math.round(Number(body.opening_balance) || 0));

  // What has accrued since the last reset — this is what is being removed
  const { cashSinceReset, openingBalance: previousFloat } = await getCashSnapshot();
  const amountAtReset = previousFloat + cashSinceReset;

  const db = createServiceClient();
  const { error } = await db.from('cash_resets').insert({
    amount_at_reset: amountAtReset,
    opening_balance: openingBalance,
    reset_at: new Date().toISOString(),
    reset_by: 'admin',
  });

  if (error) return NextResponse.json({ detail: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    amount_at_reset: amountAtReset,
    opening_balance: openingBalance,
    snapshot: await getCashSnapshot(),
  });
}
