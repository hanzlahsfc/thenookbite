-- Stop unrelated products being merged into one menu card.
--
-- The POS and website group items into a single card with a size picker or a
-- cheese toggle whenever their SKUs share a base and end in -S/-M/-L/-XL or
-- -NC/-CH. Several legacy SKUs end in those letters by coincidence rather than
-- intent — the names were edited over the years without the SKUs being changed
-- (tnb-app-wings10 is "Nuggets x 10", tnb-nug-arabian is "Chicken Strips", and
-- so on). The result is cards that merge different dishes:
--
--   tnb-app-fries-s/-m/-l   Fries Plan 250 + Masala Fries 320 + Loaded Fries 400
--   tnb-app-loadedfries-s/l Peri Peri Loaded Fries 600 + Hot Shots 500
--   tnb-app-pizzafaries-s/l Loaded Fries 600 + Peri Peri Loaded Fries 400
--   tnb-pasta-hcsp-s/-l     Peni Pasta 750 + Desi Masala Pasta 650
--   tnb-pasta-reg-s/-l      Lasagna Pasta 800 + Alfredo Pasta 1000
--   rollchpr-CH/-NC         TNB Special Wrap 700 + Arabic Shawarma 500
--   rollchs-CH/-NC          Turkish Shawarma 600 + Zinger Shawarma w/Cheese 400
--
-- This is what printed "Loaded Fries (large) (Large)  x1  Rs.400" on receipt
-- #107: two different products on one card, so the wrong size label was applied.
--
-- Changing a SKU is safe. Orders reference menu_item_id, and order_items keeps
-- its own copy of the name and price, so past bills and reports are untouched.
--
-- Run in the Supabase SQL Editor, project: thenookbite.

BEGIN;

-- ─── Items that should each stand alone ──────────────────────────────────────
UPDATE public.menu_items SET sku = 'tnb-app-friesplain'    WHERE sku = 'tnb-app-fries-s';        -- Fries Plan
UPDATE public.menu_items SET sku = 'tnb-app-masalafries'   WHERE sku = 'tnb-app-fries-m';        -- Masala Fries
UPDATE public.menu_items SET sku = 'tnb-app-hotshots'      WHERE sku = 'tnb-app-loadedfries-l';  -- Hot Shots
UPDATE public.menu_items SET sku = 'tnb-pasta-peni'        WHERE sku = 'tnb-pasta-hcsp-s';       -- Peni Pasta
UPDATE public.menu_items SET sku = 'tnb-pasta-desimasala'  WHERE sku = 'tnb-pasta-hcsp-l';       -- Desi Masala Pasta
UPDATE public.menu_items SET sku = 'tnb-pasta-lasagnaplate' WHERE sku = 'tnb-pasta-reg-s';       -- Lasagna Pasta
UPDATE public.menu_items SET sku = 'tnb-pasta-alfredo'     WHERE sku = 'tnb-pasta-reg-l';        -- Alfredo Pasta
UPDATE public.menu_items SET sku = 'tnb-roll-tnbwrap'      WHERE sku = 'rollchpr-CH';            -- TNB Special Wrap
UPDATE public.menu_items SET sku = 'tnb-roll-arabicwrap'   WHERE sku = 'rollchpr-NC';            -- Arabic Shawarma
UPDATE public.menu_items SET sku = 'tnb-roll-turkishwrap'  WHERE sku = 'rollchs-CH';             -- Turkish Shawarma
UPDATE public.menu_items SET sku = 'tnb-roll-zshawarmacheese' WHERE sku = 'rollchs-NC';          -- Zinger Shawarma w/Cheese

-- Left as a lone -NC, which renders as a cheese card with a single option
UPDATE public.menu_items SET sku = 'tnb-bur-monster'       WHERE sku = 'burzinger-NC';           -- Monster Burger

-- Ice cream: "-s" was read as Small, so Single Scoop became a one-size card
-- while Double Scoop sat separately. Both are plain items.
UPDATE public.menu_items SET sku = 'tnb-icecream-single'   WHERE sku = 'tnb-icecream-s';

-- ─── Items that genuinely ARE two sizes, but were split across wrong bases ───
-- The printed menu lists both at Small 400 / Large 600.
UPDATE public.menu_items SET sku = 'tnb-app-loaded-S',   name = 'Loaded Fries - Small'
  WHERE sku = 'tnb-app-fries-l';           -- was "Loaded Fries" 400
UPDATE public.menu_items SET sku = 'tnb-app-loaded-L',   name = 'Loaded Fries - Large'
  WHERE sku = 'tnb-app-pizzafaries-s';     -- was "Loaded Fries (large)" 600
UPDATE public.menu_items SET sku = 'tnb-app-periperi-S', name = 'Peri Peri Loaded Fries - Small'
  WHERE sku = 'tnb-app-pizzafaries-l';     -- was "Peri Peri Loaded Fries ( Small )" 400
UPDATE public.menu_items SET sku = 'tnb-app-periperi-L', name = 'Peri Peri Loaded Fries - Large'
  WHERE sku = 'tnb-app-loadedfries-s';     -- was "Peri Peri Loaded Fries ( Large )" 600

COMMIT;

-- ─── Verify ──────────────────────────────────────────────────────────────────
-- Every remaining size/cheese group, with the items it merges. Each group
-- should now contain one product in different sizes or cheese variants.
SELECT regexp_replace(sku, '-[^-]+$', '') AS card,
       count(*) AS variants,
       string_agg(name || ' @' || price, ' | ' ORDER BY sku) AS merged
FROM public.menu_items
WHERE upper(split_part(sku, '-', array_length(string_to_array(sku, '-'), 1)))
      IN ('S','M','L','XL','NC','CH')
  AND category <> 'Pizzas'
GROUP BY 1
ORDER BY 1;
