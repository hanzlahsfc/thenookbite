-- Bring the database in line with the printed menu (menu design copy.pdf):
-- remove duplicate rows, add the missing products, and register the categories
-- they belong to.
--
-- One transaction — it either all applies or none of it does.
-- Run in the Supabase SQL Editor, project: thenookbite.
--
-- Order history is safe: order_items.menu_item_id is ON DELETE SET NULL and the
-- item name and price are copied onto order_items at the time of sale, so past
-- bills and reports are unaffected by the deletions below.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Duplicates
-- ─────────────────────────────────────────────────────────────────────────────

-- Cheese Lover Pizza existed twice. Keeping the PZ-pizzatandoori group, whose
-- prices already match the menu (550/950/1450); this one had 1400/1000.
DELETE FROM public.menu_items WHERE sku IN
  ('PZ-pizzaspcheese-S','PZ-pizzaspcheese-M','PZ-pizzaspcheese-L','PZ-pizzaspcheese-XL');

-- Crispy Petti Burger existed four times. Keeping burpetti-NC (300) and
-- burpetti-CH (350), which are the printed prices; these were 320 and 360.
DELETE FROM public.menu_items WHERE sku IN
  ('tnb-bur-crispypetti-NC','tnb-bur-crispypetti-CH');

-- Same item under two names
DELETE FROM public.menu_items WHERE sku = 'APPETIZERS-1788108116749';  -- Plan Fries, kept "Fries Plan"
DELETE FROM public.menu_items WHERE sku = 'tnb-poppers';               -- Crispy Poppers, kept "Hot Shots"

-- "Lava Burger" shared the burzinger SKU base with Monster Burger, so the POS
-- merged them into one card: Monster as No Cheese, Lava as Cheese. Lava remains
-- as tnb-bur-lava-NC (700) and tnb-bur-lava-CH (750); Monster keeps burzinger-NC.
DELETE FROM public.menu_items WHERE sku = 'burzinger-CH';

-- Peri Peri was a single flat-priced row stranded in a category that no longer
-- exists. Re-added below with proper sizes.
DELETE FROM public.menu_items WHERE sku = 'PIZZA-REGULAR-V1-1787989330511';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Categories — two new sections, plus Deals which was never registered.
--    Also gives every category a distinct sort_order (Pizzas and Burgers were
--    both 2, so their tab order was arbitrary).
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.menu_categories (name, sort_order) VALUES
  ('Chinese Fusion',    6),
  ('Continental Blast', 7),
  ('Deals',             9)
ON CONFLICT (name) DO NOTHING;

UPDATE public.menu_categories SET sort_order = 1  WHERE name = 'Appetizers';
UPDATE public.menu_categories SET sort_order = 2  WHERE name = 'Pizzas';
UPDATE public.menu_categories SET sort_order = 3  WHERE name = 'Burgers';
UPDATE public.menu_categories SET sort_order = 4  WHERE name = 'Rolls & Wraps';
UPDATE public.menu_categories SET sort_order = 5  WHERE name = 'Sandwiches';
UPDATE public.menu_categories SET sort_order = 8  WHERE name = 'Pastas';
UPDATE public.menu_categories SET sort_order = 10 WHERE name = 'Drinks & Desserts';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Missing products
--    SKUs deliberately avoid ending in -S/-M/-L/-XL/-NC/-CH unless the item is
--    genuinely a size or cheese variant — that suffix is what groups rows into
--    a single card with a size picker or cheese toggle.
-- ─────────────────────────────────────────────────────────────────────────────

-- Chinese Fusion
INSERT INTO public.menu_items (sku, name, category, price, available, sort_order) VALUES
  ('tnb-cf-hotshotrice',      'Hot Shot Rice',                   'Chinese Fusion', 449, true, 1),
  ('tnb-cf-eggfriedrice',     'Egg Fried Rice',                  'Chinese Fusion', 449, true, 2),
  ('tnb-cf-chickenfriedrice', 'Chicken Fried Rice',              'Chinese Fusion', 449, true, 3),
  ('tnb-cf-masalarice',       'Masala Fried Rice with Chicken',  'Chinese Fusion', 450, true, 4),
  ('tnb-cf-manchurian',       'Chicken Manchurian + Fried Rice', 'Chinese Fusion', 800, true, 5),
  ('tnb-cf-shashlikrice',     'Shashlik with Fried Rice',        'Chinese Fusion', 800, true, 6),
  ('tnb-cf-chowmeinchicken',  'Chicken Chowmein',                'Chinese Fusion', 699, true, 7),
  ('tnb-cf-chowmeinveg',      'Vegetable Chowmein',              'Chinese Fusion', 649, true, 8),
  ('tnb-cf-chillidry',        'Chicken Chilli Dry with Rice',    'Chinese Fusion', 750, true, 9),
  ('tnb-cf-kungpaorice',      'Kung Pao Chicken with Rice',      'Chinese Fusion', 900, true, 10)
ON CONFLICT (sku) DO NOTHING;

-- Continental Blast
INSERT INTO public.menu_items (sku, name, category, price, available, sort_order) VALUES
  ('tnb-cb-teragonesteak',    'Teragone Steak',                    'Continental Blast', 1200, true, 1),
  ('tnb-cb-blackpeppersteak', 'Black Pepper Steak',                'Continental Blast', 1200, true, 2),
  ('tnb-cb-friedbroast',      'Fried Broast 4 Pcs + Fries + 4x Dip','Continental Blast', 1200, true, 3),
  ('tnb-cb-friedchickenpc',   'Fried Chicken 1 Pc',                'Continental Blast',  300, true, 4)
ON CONFLICT (sku) DO NOTHING;

-- Burgers
INSERT INTO public.menu_items (sku, name, category, price, available, sort_order) VALUES
  ('tnb-bur-beef', 'Beef Burger', 'Burgers', 950, true, 20)
ON CONFLICT (sku) DO NOTHING;

-- Pizzas the menu lists but the database did not have.
-- Regular flavour: 550 / 950 / 1450.  Special flavour: 600 / 1000 / 1600.
INSERT INTO public.menu_items (sku, name, category, price, available, sort_order) VALUES
  ('PZ-margrita-S',      'Margrita Pizza - Small',       'Pizzas',  550, true, 30),
  ('PZ-margrita-M',      'Margrita Pizza - Medium',      'Pizzas',  950, true, 31),
  ('PZ-margrita-L',      'Margrita Pizza - Large',       'Pizzas', 1450, true, 32),
  ('PZ-periperi-S',      'Peri Peri Pizza - Small',      'Pizzas',  550, true, 33),
  ('PZ-periperi-M',      'Peri Peri Pizza - Medium',     'Pizzas',  950, true, 34),
  ('PZ-periperi-L',      'Peri Peri Pizza - Large',      'Pizzas', 1450, true, 35),
  ('PZ-chickenstuff-S',  'Chicken Stuff Pizza - Small',  'Pizzas',  600, true, 36),
  ('PZ-chickenstuff-M',  'Chicken Stuff Pizza - Medium', 'Pizzas', 1000, true, 37),
  ('PZ-chickenstuff-L',  'Chicken Stuff Pizza - Large',  'Pizzas', 1600, true, 38),
  ('PZ-beeflover-S',     'Beef Lover Pizza - Small',     'Pizzas',  600, true, 39),
  ('PZ-beeflover-M',     'Beef Lover Pizza - Medium',    'Pizzas', 1000, true, 40),
  ('PZ-beeflover-L',     'Beef Lover Pizza - Large',     'Pizzas', 1600, true, 41)
ON CONFLICT (sku) DO NOTHING;

-- Small was missing on four special pizzas; the menu prices it at 600.
INSERT INTO public.menu_items (sku, name, category, price, available, sort_order) VALUES
  ('PZ-fbbehari-S',      'Behari Kabab Pizza - Small', 'Pizzas', 600, true, 42),
  ('PZ-fbcheesecrust-S', 'Cheese Crust Pizza - Small', 'Pizzas', 600, true, 43),
  ('PZ-fbkababcrust-S',  'Kabab Crust Pizza - Small',  'Pizzas', 600, true, 44),
  ('PZ-fbcrowncrust-S',  'Crown Crust Pizza - Small',  'Pizzas', 600, true, 45)
ON CONFLICT (sku) DO NOTHING;

-- Deals: four of the six were missing
INSERT INTO public.menu_items (sku, name, category, price, available, sort_order) VALUES
  ('tnb-deal-reg-250',   'Regular Flavor Pizza + 250ml Cold Drink',   'Deals',  600, true, 1),
  ('tnb-deal-reg-1litre','Regular Flavor Pizza + 1 Litre Cold Drink', 'Deals', 1500, true, 3),
  ('tnb-deal-sp-250',    'Special Flavor Pizza + 250ml Cold Drink',   'Deals',  650, true, 4),
  ('tnb-deal-sp-500',    'Special Flavor Pizza + 500ml Cold Drink',   'Deals', 1050, true, 5)
ON CONFLICT (sku) DO NOTHING;

-- Name the two existing deals consistently with the four above
UPDATE public.menu_items
SET    name = 'Regular Flavor Pizza + 500ml Cold Drink', sort_order = 2
WHERE  sku = 'PIZZAS-1788102121920';

UPDATE public.menu_items
SET    name = 'Special Flavor Pizza + 1 Litre Cold Drink', sort_order = 6
WHERE  sku = 'DEALS-1788189959190';

COMMIT;

-- ─── Verify ──────────────────────────────────────────────────────────────────
-- Item count per category, in menu order
SELECT mc.sort_order, mc.name, count(mi.id) AS items
FROM public.menu_categories mc
LEFT JOIN public.menu_items mi ON mi.category = mc.name
GROUP BY mc.sort_order, mc.name
ORDER BY mc.sort_order;

-- Anything still sitting on a category that no longer exists (expect 0 rows)
SELECT DISTINCT mi.category, count(*) AS stranded
FROM public.menu_items mi
WHERE NOT EXISTS (SELECT 1 FROM public.menu_categories mc WHERE mc.name = mi.category)
GROUP BY mi.category;
