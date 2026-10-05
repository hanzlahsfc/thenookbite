-- Cash drawer: record the opening float left in the drawer at each reset, so
-- the drawer figure can read "opening balance + cash sales since reset" rather
-- than sales alone.
--
-- Run this in the Supabase SQL Editor before deploying.

BEGIN;

ALTER TABLE public.cash_resets
  ADD COLUMN IF NOT EXISTS opening_balance int NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.cash_resets.amount_at_reset IS
  'Cash sales taken out at this reset — the total accrued since the PREVIOUS reset.';
COMMENT ON COLUMN public.cash_resets.opening_balance IS
  'Float deliberately left in the drawer at this reset. Counting starts from here.';

COMMIT;

SELECT reset_at, amount_at_reset, opening_balance, reset_by
FROM public.cash_resets
ORDER BY reset_at DESC
LIMIT 10;
