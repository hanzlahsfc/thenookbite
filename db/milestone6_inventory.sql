-- Milestone 6: Inventory
-- Run this in Supabase SQL editor

-- Stock levels per ingredient
alter table public.ingredients
  add column if not exists stock_qty    numeric(10,2) not null default 0,
  add column if not exists low_stock_threshold numeric(10,2) not null default 100,
  add column if not exists updated_at   timestamptz not null default now();

-- Stock movement log (deductions + manual adjustments)
create table if not exists public.stock_movements (
  id            uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  qty_change    numeric(10,2) not null,  -- negative = deduction, positive = restock
  reason        text not null default 'manual', -- 'order', 'manual', 'restock'
  order_id      uuid references public.orders(id) on delete set null,
  note          text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_stock_movements_ingredient on public.stock_movements (ingredient_id);
create index if not exists idx_stock_movements_order on public.stock_movements (order_id);
