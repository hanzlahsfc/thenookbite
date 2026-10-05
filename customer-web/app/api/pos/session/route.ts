import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createClient } from '@/lib/supabase/server';

// POST /api/pos/session — open a new POS session for a staff member
export async function POST(req: NextRequest) {
  const sessionClient = createClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });

  const { staff_id } = await req.json();
  if (!staff_id) return NextResponse.json({ detail: 'staff_id required' }, { status: 400 });
  if (user.id !== staff_id) return NextResponse.json({ detail: 'Forbidden' }, { status: 403 });

  const db = createServiceClient();
  const { data, error } = await db
    .from('pos_sessions')
    .insert({ staff_id })
    .select()
    .single();

  if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
