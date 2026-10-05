-- Widen staff.role beyond cashier/manager so non-POS staff can hold a real job
-- title (chef, waiter, rider, ...). The original CHECK only allowed the two POS
-- roles, so saving any other role failed at the database.
--
-- Run this in the Supabase SQL Editor BEFORE deploying the staff page changes.

BEGIN;

ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS staff_role_check;

ALTER TABLE public.staff ADD CONSTRAINT staff_role_check CHECK (role IN (
  -- POS roles (can log into the POS terminal)
  'cashier',
  'manager',
  -- Non-POS roles (attendance / payroll only)
  'chef',
  'cook',
  'kitchen_helper',
  'waiter',
  'rider',
  'cleaner',
  'dishwasher',
  'storekeeper',
  'security'
));

COMMIT;
