-- Public storage bucket for menu/category images uploaded from /admin.
-- Run in the Supabase SQL Editor.
--
-- Public read (the site displays these images), writes restricted to the
-- owner email — same model as admin_menu_write.sql.

BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-images', 'menu-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "menu images public read" ON storage.objects;
CREATE POLICY "menu images public read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'menu-images');

DROP POLICY IF EXISTS "menu images owner insert" ON storage.objects;
CREATE POLICY "menu images owner insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'menu-images'
    AND auth.jwt() ->> 'email' = 'thenookbite@gmail.com'
  );

DROP POLICY IF EXISTS "menu images owner update" ON storage.objects;
CREATE POLICY "menu images owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND auth.jwt() ->> 'email' = 'thenookbite@gmail.com'
  );

DROP POLICY IF EXISTS "menu images owner delete" ON storage.objects;
CREATE POLICY "menu images owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND auth.jwt() ->> 'email' = 'thenookbite@gmail.com'
  );

COMMIT;
