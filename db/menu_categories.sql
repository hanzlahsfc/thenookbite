-- Menu categories become data instead of a hardcoded TypeScript array, so they
-- can be added, renamed and reordered from the admin panel without a deploy.
--
-- Run this in the Supabase SQL Editor before deploying the categories feature.

BEGIN;

CREATE TABLE IF NOT EXISTS public.menu_categories (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,   -- must match menu_items.category
  display_label text,                   -- customer-facing name, when different
  image_url     text,
  sort_order    int  not null default 0,
  created_at    timestamptz not null default now()
);

ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;

-- Menu categories are public information (the customer menu reads them)
DROP POLICY IF EXISTS "menu_categories readable" ON public.menu_categories;
CREATE POLICY "menu_categories readable" ON public.menu_categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "menu_categories service all" ON public.menu_categories;
CREATE POLICY "menu_categories service all" ON public.menu_categories
  USING (true) WITH CHECK (true);

-- Seed from what the code currently hardcodes, preserving order and imagery
INSERT INTO public.menu_categories (name, display_label, sort_order, image_url) VALUES
  ('Appetizers',        NULL,            1, 'https://images.unsplash.com/photo-1576107232684-1279f390859f?auto=format&fit=crop&w=600&q=75'),
  ('Burgers',           NULL,            2, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=75'),
  ('Food Bank',         NULL,            3, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&q=75'),
  ('Pastas',            NULL,            4, 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=600&q=75'),
  ('Pizza Regular v1',  'Pizza Classic', 5, 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=75'),
  ('Pizza Special',     NULL,            6, 'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?auto=format&fit=crop&w=600&q=75'),
  ('Rolls & Wraps',     NULL,            7, 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=600&q=75'),
  ('Sandwiches',        NULL,            8, 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=75'),
  ('Drinks & Desserts', NULL,            9, 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=600&q=75')
ON CONFLICT (name) DO NOTHING;

-- Renaming must move the category AND every item under it, or the menu silently
-- loses those items. A function body is one transaction, so this cannot half-apply.
CREATE OR REPLACE FUNCTION public.rename_menu_category(p_old text, p_new text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_old = p_new THEN RETURN; END IF;

  IF EXISTS (SELECT 1 FROM public.menu_categories WHERE name = p_new) THEN
    RAISE EXCEPTION 'A category named "%" already exists', p_new;
  END IF;

  UPDATE public.menu_categories SET name = p_new WHERE name = p_old;
  UPDATE public.menu_items      SET category = p_new WHERE category = p_old;
END;
$$;

-- Catch any category present on items but missing from the new table
INSERT INTO public.menu_categories (name, sort_order)
SELECT DISTINCT mi.category, 99
FROM public.menu_items mi
WHERE NOT EXISTS (SELECT 1 FROM public.menu_categories mc WHERE mc.name = mi.category)
ON CONFLICT (name) DO NOTHING;

COMMIT;

-- Should list 9 categories, each with its live item count
SELECT mc.name, mc.display_label, mc.sort_order, count(mi.id) AS items
FROM public.menu_categories mc
LEFT JOIN public.menu_items mi ON mi.category = mc.name
GROUP BY mc.id, mc.name, mc.display_label, mc.sort_order
ORDER BY mc.sort_order;
