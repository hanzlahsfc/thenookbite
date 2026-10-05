-- Bring menu_items prices in line with the printed menu (menu design copy.pdf).
--
-- Every Medium in the special-pizza range was Rs.300 over the printed price, so
-- the POS was overcharging on those. The regular-flavour deal carried the
-- special-flavour price.
--
-- Run this in the Supabase SQL Editor (project: thenookbite).
--
-- Not touched here, because they need a decision rather than a correction:
--   * "Kung Pao Chicken" Rs.700 vs the menu's "Kung Pao Chicken with rice"
--     Rs.900, and "Egg Fried Rice + Shashlik" Rs.750 vs "Shashlik with Fried
--     Rice" Rs.800 — these may be different portions, not mispriced rows.
--   * duplicate rows (Cheese Lover Pizza x2, Crispy Petti Burger x3,
--     Fries Plan / Plan Fries, Hot Shots / Crispy Poppers) — deleting menu
--     items is destructive and needs your call on which to keep.

BEGIN;

-- Special-flavour pizzas: printed Medium is 1000, not 1300
UPDATE public.menu_items SET price = 1000 WHERE sku = 'PZ-fbbehari-M';        -- was 1300
UPDATE public.menu_items SET price = 1000 WHERE sku = 'PZ-fbcheesecrust-M';   -- was 1300
UPDATE public.menu_items SET price = 1000 WHERE sku = 'PZ-fbcrowncrust-M';    -- was 1300
UPDATE public.menu_items SET price = 1000 WHERE sku = 'PZ-fbkababcrust-M';    -- was 1300

-- TNB Special Pizza: printed Medium 1000, Small 600
UPDATE public.menu_items SET price = 1000 WHERE sku = 'PZ-pizzasphunger-M';   -- was 1100
UPDATE public.menu_items SET price =  600 WHERE sku = 'PZ-pizzasphunger-S';   -- was 550

-- Regular-flavour deal with a 500ml drink is 1000; 1050 is the special-flavour price
UPDATE public.menu_items SET price = 1000 WHERE sku = 'PIZZAS-1788102121920'; -- was 1050

COMMIT;

-- Confirm: every row below should show the printed price
SELECT sku, name, price
FROM public.menu_items
WHERE sku IN (
  'PZ-fbbehari-M', 'PZ-fbcheesecrust-M', 'PZ-fbcrowncrust-M', 'PZ-fbkababcrust-M',
  'PZ-pizzasphunger-M', 'PZ-pizzasphunger-S', 'PIZZAS-1788102121920'
)
ORDER BY name;
