import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdminApi } from '@/lib/admin-auth';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const authErr = await requireAdminApi();
  if (authErr) return authErr;
  const db = createServiceClient();

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ detail: 'No file provided' }, { status: 400 });

  const ext = file.name.split('.').pop();
  const path = `${params.id}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await db.storage.from('menu-images').upload(path, buffer, {
    contentType: file.type,
    upsert: true,
  });

  if (error) return NextResponse.json({ detail: error.message }, { status: 500 });

  const { data } = db.storage.from('menu-images').getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
