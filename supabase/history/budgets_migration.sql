-- Budgets: named envelopes tracked against the band fund (tracking only, no reserve).
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  allocated_amount numeric not null check (allocated_amount >= 0),
  recurrence text not null default 'none' check (recurrence in ('none', 'monthly')),
  start_date date not null default current_date,
  end_date date,
  status text not null default 'active' check (status in ('active', 'closed')),
  created_by uuid not null,
  created_at timestamptz not null default now()
);

-- Log of allocation changes (initial, top-up, reduction, close/reopen).
create table if not exists public.budget_adjustments (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.budgets(id) on delete cascade,
  kind text not null check (kind in ('created', 'top_up', 'reduce', 'closed', 'reopened')),
  delta numeric not null default 0,
  note text,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

alter table public.finance_transactions
  add column if not exists budget_id uuid references public.budgets(id) on delete set null;
create index if not exists finance_transactions_budget_id_idx on public.finance_transactions(budget_id);

alter table public.budgets enable row level security;
alter table public.budget_adjustments enable row level security;
drop policy if exists "authenticated full access" on public.budgets;
create policy "authenticated full access" on public.budgets for all to authenticated using (true) with check (true);
drop policy if exists "authenticated full access" on public.budget_adjustments;
create policy "authenticated full access" on public.budget_adjustments for all to authenticated using (true) with check (true);
