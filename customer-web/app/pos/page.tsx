import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { buildMenuCards } from '@/lib/menu';
import type { MenuItem } from '@/lib/types';
import { POSTerminal } from './POSTerminal';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { getCategoryNames } from '@/lib/menuCategories';
import { pkDate } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

export default async function POSPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/pos/login');

  const db = createServiceClient();
  const adminEmail = process.env.ADMIN_EMAIL;
  const isAdmin = user.email === adminEmail;

  if (!isAdmin) {
    const { data: staffRow } = await db
      .from('staff')
      .select('id, is_active')
      .eq('id', user.id)
      .single();

    if (!staffRow || !staffRow.is_active) redirect('/pos/login');
  }

  const { data: staffRow } = await db
    .from('staff')
    .select('full_name, role')
    .eq('id', user.id)
    .maybeSingle();

  const staffName = staffRow?.full_name ?? (isAdmin ? 'Admin' : 'Staff');
  const staffRole = staffRow?.role ?? (isAdmin ? 'admin' : 'cashier');

  // Reuse an open session only if it started today in Pakistan. A rolling 24h
  // window let an unclosed session carry over midnight, so orders placed today
  // attached to yesterday's session and vanished from the admin day view.
  const startOfDayISO = `${pkDate()}T00:00:00+05:00`;

  const findOpenSession = async () => {
    const { data } = await db
      .from('pos_sessions')
      .select('id')
      .eq('staff_id', user.id)
      .is('ended_at', null)
      .gte('started_at', startOfDayISO)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.id ?? '';
  };

  let sessionId = await findOpenSession();

  if (!sessionId) {
    // The tab-close beacon ends the session, so a refresh or reopening the POS
    // would otherwise start a fresh one each time and chop the day into
    // fragments. Resume today's session instead; only a new day starts a new one.
    const { data: earlier } = await db
      .from('pos_sessions')
      .select('id')
      .eq('staff_id', user.id)
      .gte('started_at', startOfDayISO)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (earlier?.id) {
      await db.from('pos_sessions').update({ ended_at: null }).eq('id', earlier.id);
      sessionId = earlier.id;
    }
  }

  if (!sessionId) {
    const { data: newSession, error: sessErr } = await db
      .from('pos_sessions')
      .insert({ staff_id: user.id })
      .select('id')
      .single();

    if (sessErr) {
      // A concurrent page load won the race and the unique index rejected this
      // insert — take the session it created rather than leaving the POS
      // without one (see db/pos_sessions_one_open.sql).
      sessionId = await findOpenSession();
      if (!sessionId) console.error('[POS] Failed to create session:', sessErr.message);
    } else {
      sessionId = newSession?.id ?? '';
    }
  }

  const { data, error } = await db
    .from('menu_items')
    .select('*')
    .eq('available', true)
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true });

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0d0d0d] text-red-400 font-heading text-sm">
        Failed to load menu: {error.message}
      </div>
    );
  }

  const items = (data ?? []) as MenuItem[];
  const cards = buildMenuCards(items);

  // For the SESSION REPORT panel's header
  let sessionStartedAt: string | null = null;
  if (sessionId) {
    const { data: sess } = await db.from('pos_sessions').select('started_at').eq('id', sessionId).maybeSingle();
    sessionStartedAt = sess?.started_at ?? null;
  }

  // Only set staff_id on orders if the user has a row in the staff table.
  // Admin has no staff row — passing their auth UID would violate orders_staff_id_fkey.
  const orderStaffId = staffRow ? user.id : null;

  // Tabs are the managed categories plus any category still sitting on an item.
  // Without the union, an item whose category was renamed or removed has no tab
  // and is unreachable in the POS, while the admin menu still lists it.
  const managed = await getCategoryNames();
  const onItems = [...new Set(items.map(i => i.category))];
  const categories = [...managed, ...onItems.filter(c => !managed.includes(c))];

  return (
    <ErrorBoundary>
      <POSTerminal
        cards={cards}
        staffId={orderStaffId}
        staffName={staffName}
        staffRole={staffRole}
        sessionId={sessionId}
        sessionStartedAt={sessionStartedAt}
        categories={categories}
      />
    </ErrorBoundary>
  );
}
