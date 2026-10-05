import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/pos/session/close — close the caller's open POS session.
 *
 * Takes no body and derives the operator from the session cookie, so it can be
 * fired by navigator.sendBeacon on tab close (a beacon can only POST, and
 * cannot set headers) as well as from the Sign Out buttons.
 */
export async function POST() {
  const sessionClient = createClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });

  const db = createServiceClient();
  const { error } = await db
    .from('pos_sessions')
    .update({ ended_at: new Date().toISOString() })
    .eq('staff_id', user.id)
    .is('ended_at', null);

  if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
