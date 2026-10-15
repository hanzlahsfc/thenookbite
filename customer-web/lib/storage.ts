import { getSupabase } from '@/lib/supabase';

const BUCKET = 'menu-images';

/**
 * Upload an image to the public `menu-images` bucket and return its public URL.
 * Throws on failure — caller should surface the message to the admin.
 */
export async function uploadMenuImage(file: File): Promise<string> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase is not configured');
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || 'image/jpeg',
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
