import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createClient } from '@/lib/supabase/server';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  const sessionClient = createClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('photo') as File | null;

  if (!file) {
    return NextResponse.json({ detail: 'No photo' }, { status: 400 });
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ detail: 'Only JPEG, PNG, or WebP images allowed' }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ detail: 'File too large (max 5 MB)' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = `checkin-${Date.now()}.jpg`;
  const path = `photos/${new Date().toISOString().slice(0, 10)}/${fileName}`;

  const db = createServiceClient();
  const { error } = await db.storage
    .from('attendance-photos')
    .upload(path, buffer, { contentType: 'image/jpeg', upsert: false });

  if (error) {
    // Don't block check-in if upload fails
    return NextResponse.json({ url: null });
  }

  // Store the storage path, not a public URL — admin routes generate signed URLs on demand
  return NextResponse.json({ url: path });
}
