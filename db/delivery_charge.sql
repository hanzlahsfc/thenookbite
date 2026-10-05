-- Delivery charge on orders.
--
-- Stored as its own column rather than folded into total, so it can be reported
-- on separately and shown as its own line on the bill.
--
-- Run this in the Supabase SQL Editor (project: thenookbite) before deploying.

BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_charge int NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.orders.delivery_charge IS
  'Delivery fee in PKR, included in total. Zero for dine-in and takeaway.';

COMMIT;

SELECT order_number, order_type, delivery_charge, total
FROM public.orders
ORDER BY order_number DESC
LIMIT 5;
