-- Purge test orders and restart order numbering at 1.
--
-- Keeps only the pending order placed 2026-08-23 (currently #64), renumbers it
-- to #1, and resets the sequence so the next order placed is #2.
--
-- Backup of all 60 orders + 148 order_items before this ran:
--   db/backup-orders-2026-08-23/orders-with-items.json
--
-- Cascade behaviour (verified against the live schema):
--   order_items.order_id     ON DELETE CASCADE   -> items go with their order
--   stock_movements.order_id ON DELETE SET NULL  -> movement rows survive,
--                                                   ingredient stock unchanged
--
-- Run this in the Supabase SQL Editor. It is one transaction: all or nothing.

BEGIN;

-- 1. Delete every order except the one being kept
DELETE FROM orders
WHERE  order_number <> 64;

-- 2. Renumber the survivor to 1
UPDATE orders
SET    order_number = 1
WHERE  order_number = 64;

-- 3. Point the sequence at 1 so the next insert gets 2
SELECT setval(
  pg_get_serial_sequence('orders', 'order_number'),
  (SELECT COALESCE(MAX(order_number), 0) FROM orders),
  true
);

-- 4. Sanity check — should return exactly one row: order_number = 1
SELECT order_number, customer_name, total, status, created_at FROM orders;

COMMIT;
