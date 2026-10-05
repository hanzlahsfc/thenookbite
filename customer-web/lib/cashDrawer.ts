import { createServiceClient } from '@/lib/supabase/service';

export interface CashReset {
  id: string;
  amount_at_reset: number;
  opening_balance: number;
  reset_at: string;
  reset_by: string;
}

export interface CashMovement {
  id: string;
  amount: number;
  direction: 'in' | 'out';
  reason: string | null;
  created_at: string;
  created_by: string;
}

export interface CashSnapshot {
  /** Float left in the drawer at the last reset — the count starts here. */
  openingBalance: number;
  /** Cash sales taken since the last reset. */
  cashSinceReset: number;
  /** What should physically be in the drawer now. */
  expectedInDrawer: number;
  /** Cash added to the drawer by hand since the last reset. */
  paidIn: number;
  /** Cash removed from the drawer by hand since the last reset. */
  paidOut: number;
  /** All cash since midnight, regardless of resets. Reference only. */
  cashTotal: number;
  resets: CashReset[];
  movements: CashMovement[];
}

async function sumCashSince(db: ReturnType<typeof createServiceClient>, iso: string) {
  const { data } = await db
    .from('orders')
    .select('total, payment_method, payment_status')
    .neq('status', 'cancelled')
    .gte('created_at', iso)
    .in('payment_method', ['cash', 'pay_later'])
    .eq('payment_status', 'paid');

  return (data ?? [])
    .filter(o => o.payment_method === 'cash')
    .reduce((s, o) => s + (o.total ?? 0), 0);
}

/**
 * One source of truth for the cash figures, so the server page and the polling
 * API can never disagree.
 */
export async function getCashSnapshot(): Promise<CashSnapshot> {
  const db = createServiceClient();

  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);

  const { data: resets } = await db
    .from('cash_resets')
    .select('id, amount_at_reset, opening_balance, reset_at, reset_by')
    .order('reset_at', { ascending: false })
    .limit(10);

  const lastReset = resets?.[0];

  const periodStart = lastReset?.reset_at ?? midnight.toISOString();

  const [cashTotal, cashSinceReset, movementRes] = await Promise.all([
    sumCashSince(db, midnight.toISOString()),
    sumCashSince(db, periodStart),
    db.from('cash_movements')
      .select('id, amount, direction, reason, created_at, created_by')
      .gte('created_at', periodStart)
      .order('created_at', { ascending: false }),
  ]);

  const movements = (movementRes.data ?? []) as CashMovement[];
  const paidIn  = movements.filter(m => m.direction === 'in').reduce((s, m) => s + m.amount, 0);
  const paidOut = movements.filter(m => m.direction === 'out').reduce((s, m) => s + m.amount, 0);

  const openingBalance = lastReset?.opening_balance ?? 0;

  return {
    openingBalance,
    cashSinceReset,
    paidIn,
    paidOut,
    expectedInDrawer: openingBalance + cashSinceReset + paidIn - paidOut,
    cashTotal,
    resets: (resets ?? []) as CashReset[],
    movements,
  };
}

/** Cash accrued since the last reset — what is actually being taken out now. */
export async function cashTakenSinceLastReset(): Promise<number> {
  return (await getCashSnapshot()).cashSinceReset;
}
