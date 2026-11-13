-- Merch: what the band sells, how much is in the box, and what went out at each show.
--
-- Stock is never stored as a number. Every change is a row in merch_stock_moves (+ restock / return,
-- - sale / giveaway / damaged, +/- count fix), and stock on hand is the sum of those rows. Per show is the same
-- sum filtered by show_id, so the totals can't drift.
--
-- Gated by the new "merch" section (edit / view / none per member, like every other section).
-- Additive and safe to re-run.

begin;

-- ---- Items: a product line (Logo tee, Sticker pack, CD) ----------------------------------------------------------
create table if not exists public.merch_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  kind text check (kind is null or char_length(kind) <= 40),
  description text check (description is null or char_length(description) <= 2000),
  image_url text check (image_url is null or char_length(image_url) <= 1000),
  -- Default selling price for every variant; a variant can set its own.
  price numeric(12, 2) not null default 0 check (price >= 0),
  archived_at timestamptz,
  position double precision not null default 0,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (id, workspace_id)
);
create unique index if not exists merch_items_name_idx on public.merch_items (workspace_id, lower(btrim(name))) where archived_at is null;
create index if not exists merch_items_ws_idx on public.merch_items (workspace_id);

-- ---- Variants: the thing you actually count (Black / M). An item with no sizes has one "One size" variant -------
create table if not exists public.merch_variants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  item_id uuid not null,
  label text not null default 'One size' check (char_length(btrim(label)) between 1 and 40),
  -- Null means the item's price.
  price numeric(12, 2) check (price is null or price >= 0),
  -- Warn when stock on hand falls to this or below. Null means no warning.
  low_stock_at integer check (low_stock_at is null or low_stock_at >= 0),
  archived_at timestamptz,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (item_id, workspace_id) references public.merch_items (id, workspace_id) on delete cascade
);
create unique index if not exists merch_variants_label_idx on public.merch_variants (item_id, lower(btrim(label))) where archived_at is null;
create index if not exists merch_variants_ws_idx on public.merch_variants (workspace_id);

-- ---- Batches: one production run or restock, with what it cost in total ------------------------------------------
create table if not exists public.merch_batches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  date date not null default current_date,
  supplier text check (supplier is null or char_length(supplier) <= 120),
  total_cost numeric(12, 2) not null default 0 check (total_cost >= 0),
  notes text check (notes is null or char_length(notes) <= 2000),
  -- The Finance expense this batch was logged as, if any.
  finance_transaction_id uuid references public.finance_transactions(id) on delete set null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (id, workspace_id)
);
create index if not exists merch_batches_ws_idx on public.merch_batches (workspace_id, date desc);

-- ---- Sales: one sale, or one show's merch takings, and how the money came in -------------------------------------
create table if not exists public.merch_sales (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  show_id uuid references public.shows(id) on delete set null,
  date date not null default current_date,
  -- 'count': end-of-night count (took out vs brought back); 'stall': tap-to-sell; 'manual': anything else (online, friends).
  mode text not null default 'manual' check (mode in ('count', 'stall', 'manual')),
  cash_amount numeric(12, 2) not null default 0 check (cash_amount >= 0),
  upi_amount numeric(12, 2) not null default 0 check (upi_amount >= 0),
  card_amount numeric(12, 2) not null default 0 check (card_amount >= 0),
  -- Who ran the stall / is holding the money.
  held_by uuid references auth.users(id) on delete set null,
  account_id uuid,
  -- The Finance income entry these takings were logged as, if any.
  finance_transaction_id uuid references public.finance_transactions(id) on delete set null,
  notes text check (notes is null or char_length(notes) <= 2000),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (account_id, workspace_id) references public.finance_accounts (id, workspace_id)
);
create index if not exists merch_sales_ws_idx on public.merch_sales (workspace_id, date desc);
create index if not exists merch_sales_show_idx on public.merch_sales (show_id) where show_id is not null;

-- ---- Stock moves: the one source of truth for how many of each variant there are --------------------------------
create table if not exists public.merch_stock_moves (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  variant_id uuid not null,
  qty integer not null check (qty <> 0),
  reason text not null check (reason in ('restock', 'sale', 'giveaway', 'damaged', 'return', 'count_fix')),
  -- What one unit cost to make (restocks), for profit; and what one sold for (sales).
  unit_cost numeric(12, 2) check (unit_cost is null or unit_cost >= 0),
  unit_price numeric(12, 2) check (unit_price is null or unit_price >= 0),
  show_id uuid references public.shows(id) on delete set null,
  batch_id uuid,
  sale_id uuid,
  note text check (note is null or char_length(note) <= 500),
  date date not null default current_date,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  -- Stock in is positive, stock out is negative; only a count fix can go either way.
  check (
    (reason in ('restock', 'return') and qty > 0) or
    (reason in ('sale', 'giveaway', 'damaged') and qty < 0) or
    reason = 'count_fix'
  ),
  foreign key (variant_id, workspace_id) references public.merch_variants (id, workspace_id) on delete cascade,
  foreign key (batch_id, workspace_id) references public.merch_batches (id, workspace_id) on delete cascade,
  foreign key (sale_id, workspace_id) references public.merch_sales (id, workspace_id) on delete cascade
);
create index if not exists merch_stock_moves_ws_idx on public.merch_stock_moves (workspace_id, date desc);
create index if not exists merch_stock_moves_variant_idx on public.merch_stock_moves (variant_id);
create index if not exists merch_stock_moves_show_idx on public.merch_stock_moves (show_id) where show_id is not null;
create index if not exists merch_stock_moves_batch_idx on public.merch_stock_moves (batch_id) where batch_id is not null;
create index if not exists merch_stock_moves_sale_idx on public.merch_stock_moves (sale_id) where sale_id is not null;

-- ---- Row-level security: members of the workspace, limited by their "merch" section level ------------------------
do $$
declare t text;
begin
  foreach t in array array['merch_items', 'merch_variants', 'merch_batches', 'merch_sales', 'merch_stock_moves'] loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists ws_select on public.%I', t);
    execute format('create policy ws_select on public.%I for select to authenticated using (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) <> ''none'')', t);
    execute format('drop policy if exists ws_insert on public.%I', t);
    execute format('create policy ws_insert on public.%I for insert to authenticated with check (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = ''full'')', t);
    execute format('drop policy if exists ws_update on public.%I', t);
    execute format('create policy ws_update on public.%I for update to authenticated using (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = ''full'') with check (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = ''full'')', t);
    execute format('drop policy if exists ws_delete on public.%I', t);
    execute format('create policy ws_delete on public.%I for delete to authenticated using (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = ''full'')', t);

    execute format('drop policy if exists ws_section_read on public.%I', t);
    execute format('create policy ws_section_read on public.%I as restrictive for select to authenticated using (public.section_level(workspace_id, ''merch'') <> ''none'')', t);
    execute format('drop policy if exists ws_section_insert on public.%I', t);
    execute format('create policy ws_section_insert on public.%I as restrictive for insert to authenticated with check (public.section_level(workspace_id, ''merch'') = ''edit'')', t);
    execute format('drop policy if exists ws_section_update on public.%I', t);
    execute format('create policy ws_section_update on public.%I as restrictive for update to authenticated using (public.section_level(workspace_id, ''merch'') = ''edit'') with check (public.section_level(workspace_id, ''merch'') = ''edit'')', t);
    execute format('drop policy if exists ws_section_delete on public.%I', t);
    execute format('create policy ws_section_delete on public.%I as restrictive for delete to authenticated using (public.section_level(workspace_id, ''merch'') = ''edit'')', t);

    execute format('revoke all on public.%I from anon', t);

    -- The phone app listens to the change feed to keep its copy fresh.
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Grants: Supabase no longer opens new tables to the API on its own (from 2026-10-30), so say who may reach them.
-- Row-level security above still decides which rows; logged-out visitors get nothing.
grant select, insert, update, delete on public.merch_items to authenticated;
grant select, insert, update, delete on public.merch_items to service_role;
grant select, insert, update, delete on public.merch_variants to authenticated;
grant select, insert, update, delete on public.merch_variants to service_role;
grant select, insert, update, delete on public.merch_batches to authenticated;
grant select, insert, update, delete on public.merch_batches to service_role;
grant select, insert, update, delete on public.merch_sales to authenticated;
grant select, insert, update, delete on public.merch_sales to service_role;
grant select, insert, update, delete on public.merch_stock_moves to authenticated;
grant select, insert, update, delete on public.merch_stock_moves to service_role;

commit;
