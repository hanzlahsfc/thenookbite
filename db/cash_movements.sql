-- Cash paid in / paid out of the drawer between resets.
--
-- Until now the only operation was a full reset (take everything, set a new
-- float). This records partial movements: taking 2000 to the bank, or topping
-- the float up by 3000, without closing the counting period.
--
-- Run this in the Supabase SQL Editor (project: thenookbite) before deploying.

BEGIN;

CREATE TABLE IF NOT EXISTS public.cash_movements (
  id          uuid primary key default gen_random_uuid(),
  amount      int  not null check (amount > 0),   -- always positive; direction carries the sign
  direction   text not null check (direction in ('in', 'out')),
  reason      text,
  created_at  timestamptz not null default now(),
  created_by  text not null default 'admin'
);

CREATE INDEX IF NOT EXISTS cash_movements_created_idx
  ON public.cash_movements (created_at DESC);

ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_movements service all" ON public.cash_movements;
CREATE POLICY "cash_movements service all" ON public.cash_movements
  USING (true) WITH CHECK (true);

COMMIT;

SELECT 'cash_movements ready' AS status;
