import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createClient } from '@/lib/supabase/server';
import { EXPENSE_CATEGORIES } from '@/lib/expenseCategories';

/**
 * Expenses logged from the POS terminal — till cash spent on something during
 * a shift (ice, a repair, a delivery driver's fuel) rather than through the
 * admin ledger. Same `expenses` table the admin ledger reads, so nothing
 * logged here needs re-entering later; `session_id` and `recorded_by` just
 * say where it came from.
 *
 * Open to any signed-in POS user (cashier or admin), not admin-only like the
 * ledger route — a cashier is exactly who is standing at the till when this
 * comes up, matching how order edits and item changes already work.
 */

async function currentStaffName(userId: string, email: string | undefined) {
  const db = createServiceClient();
  const { data } = await db.from('staff').select('full_name').eq('id', userId).maybeSingle();
  if (data?.full_name) return data.full_name;
  return email && email === process.env.ADMIN_EMAIL ? 'Admin' : 'Staff';
}

export async function POST(req: NextRequest) {
  const sessionClient = createClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });

  const { category, amount, description, session_id } = await req.json().catch(() => ({}));

  if (typeof category !== 'string' || !EXPENSE_CATEGORIES.includes(category as (typeof EXPENSE_CATEGORIES)[number])) {
    return NextResponse.json({ detail: `category must be one of: ${EXPENSE_CATEGORIES.join(', ')}` }, { status: 400 });
  }
  const parsedAmount = Math.round(Number(amount));
  if (!parsedAmount || parsedAmount <= 0) {
    return NextResponse.json({ detail: 'amount must be a positive number' }, { status: 400 });
  }

  const recordedBy = await currentStaffName(user.id, user.email);

  const db = createServiceClient();
  const { data, error } = await db
    .from('expenses')
    .insert({
      category,
      amount: parsedAmount,
      description: typeof description === 'string' ? description.trim() || null : null,
      session_id: typeof session_id === 'string' && session_id ? session_id : null,
      recorded_by: recordedBy,
    })
    .select('id, category, amount, description, expense_date, recorded_by')
    .single();

  if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// Expenses logged during one POS shift — powers the SESSION REPORT panel.
export async function GET(req: NextRequest) {
  const sessionClient = createClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });

  const sessionId = req.nextUrl.searchParams.get('session_id');
  if (!sessionId) return NextResponse.json({ detail: 'session_id required' }, { status: 400 });

  const db = createServiceClient();
  const { data, error } = await db
    .from('expenses')
    .select('id, category, amount, description, created_at, recorded_by')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
