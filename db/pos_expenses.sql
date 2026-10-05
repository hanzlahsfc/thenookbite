-- Let expenses be recorded from the POS terminal itself, not only the admin
-- ledger, and attribute each one to the staff member and shift it happened in.
--
-- Existing rows (all entered from /admin/ledger so far) get NULL for both —
-- there is no session or specific staff member to backfill them with, and NULL
-- correctly reads as "not tied to a POS shift."
--
-- Run in the Supabase SQL Editor (project: thenookbite) before deploying.

BEGIN;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS recorded_by text,
  ADD COLUMN IF NOT EXISTS session_id  uuid REFERENCES public.pos_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_session ON public.expenses (session_id);

COMMENT ON COLUMN public.expenses.recorded_by IS
  'Staff name at the time the expense was logged. Text, not a foreign key — stays readable even if the staff account is later removed.';
COMMENT ON COLUMN public.expenses.session_id IS
  'POS shift this was logged during, when logged from the POS terminal. NULL for expenses entered from the admin ledger.';

COMMIT;

SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'expenses'
ORDER BY ordinal_position;
