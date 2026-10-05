-- Add customer_phone to orders table
-- Run this in Supabase SQL editor

alter table public.orders
  add column if not exists customer_phone text;

-- Index for fast phone lookups
create index if not exists idx_orders_customer_phone on public.orders (customer_phone);
