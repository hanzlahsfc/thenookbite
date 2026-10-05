import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createClient } from '@/lib/supabase/server';

const VALID_STATUSES = new Set(['pending', 'preparing', 'ready', 'completed', 'cancelled']);

// The kitchen display runs unauthenticated by design (an internal screen on the
// shop network — see CLAUDE.md), so the transitions it drives must not require a
// session. Cancelling is not one of them: that is destructive and stays behind
// auth, where the POS, admin and customer screens already call it from.
const KITCHEN_STATUSES = new Set(['preparing', 'ready', 'completed']);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { status } = await req.json();

  if (!VALID_STATUSES.has(status)) {
    return NextResponse.json({ detail: 'Invalid status' }, { status: 400 });
  }

  if (!KITCHEN_STATUSES.has(status)) {
    const sessionClient = createClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    if (!user) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ detail: 'Order not found' }, { status: 404 });
  return NextResponse.json(data);
}
