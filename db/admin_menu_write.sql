-- Admin write access for the /admin panel (menu items + categories).
-- Run in the Supabase SQL Editor.
--
-- Model: writes require a signed-in session whose JWT email matches the
-- owner email below. The email check (not just `authenticated`) is what stops
-- a random visitor from signing up via the public signup endpoint and gaining
-- write access — keep it in sync with NEXT_PUBLIC_ADMIN_EMAIL.

BEGIN;

-- ─── menu_items ───────────────────────────────────────────────
-- Public read already exists ("menu public read" in schema.sql).
-- Add write policies for the owner only.

DROP POLICY IF EXISTS "menu_items admin insert" ON public.menu_items;
CREATE POLICY "menu_items admin insert" ON public.menu_items
  FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() ->> 'email' = 'thenookbite@gmail.com');

DROP POLICY IF EXISTS "menu_items admin update" ON public.menu_items;
CREATE POLICY "menu_items admin update" ON public.menu_items
  FOR UPDATE TO authenticated
  USING (auth.jwt() ->> 'email' = 'thenookbite@gmail.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'thenookbite@gmail.com');

DROP POLICY IF EXISTS "menu_items admin delete" ON public.menu_items;
CREATE POLICY "menu_items admin delete" ON public.menu_items
  FOR DELETE TO authenticated
  USING (auth.jwt() ->> 'email' = 'thenookbite@gmail.com');

-- ─── menu_categories ──────────────────────────────────────────
-- menu_categories.sql created "service all" (USING true / WITH CHECK true) with
-- no role restriction — that policy also lets the ANON key write, so anyone
-- could edit or delete categories. Drop it and scope writes to the owner.

DROP POLICY IF EXISTS "menu_categories service all" ON public.menu_categories;

DROP POLICY IF EXISTS "menu_categories admin insert" ON public.menu_categories;
CREATE POLICY "menu_categories admin insert" ON public.menu_categories
  FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() ->> 'email' = 'thenookbite@gmail.com');

DROP POLICY IF EXISTS "menu_categories admin update" ON public.menu_categories;
CREATE POLICY "menu_categories admin update" ON public.menu_categories
  FOR UPDATE TO authenticated
  USING (auth.jwt() ->> 'email' = 'thenookbite@gmail.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'thenookbite@gmail.com');

DROP POLICY IF EXISTS "menu_categories admin delete" ON public.menu_categories;
CREATE POLICY "menu_categories admin delete" ON public.menu_categories
  FOR DELETE TO authenticated
  USING (auth.jwt() ->> 'email' = 'thenookbite@gmail.com');

COMMIT;

-- Sanity check: should show read policies for anon + write policies for authenticated
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename IN ('menu_items', 'menu_categories')
ORDER BY tablename, policyname;
