-- Show kits and Merch crew.
--
-- A kit is the box packed for one show: how many of each size went, at what show price. Packing a kit doesn't
-- change stock (the band still owns it); sales from the kit do. At the end of the night the kit is closed with what
-- came back, what was given away or lost, and the money handed in. An approver then approves the kit: one Finance
-- income entry, giveaways and losses taken off stock, and everything locked.
--
-- Merch crew (workspace_members.permissions.merch_crew = true) only ever see their own kits: the show's name,
-- date and venue, the items in the box, and the sales they made. No stock totals, costs, other shows or Finance.
-- Crew never write to the tables directly; they sell and close through record_kit_sale / close_merch_kit.
--
--   merch_scope(ws)                      'full', 'crew' or 'none' for the signed-in member
--   my_merch_kits()                      the signed-in member's kits, with show name / date / venue
--   record_kit_sale(...)                 a sale from a kit (never more than is left in the box)
--   undo_kit_sale(sale)                  takes back a sale while the kit is open
--   close_merch_kit(...)                 end of night: counts and money handed in
--   reopen_merch_kit(kit)                undo a close
--   approve_merch_kit(kit, member, acc)  approves a closed kit into Finance
--
-- Additive and safe to re-run.

begin;

-- ---- Kits ------------------------------------------------------------------------------------------------------------
create table if not exists public.merch_kits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  -- Null only if the show was deleted later; the kit and its sales stay as history.
  show_id uuid,
  -- Who is in charge of the stall, and who else can sell from this kit.
  lead_id uuid references auth.users(id) on delete set null,
  helper_ids uuid[] not null default '{}',
  status text not null default 'open' check (status in ('open', 'closed', 'approved')),
  notes text check (notes is null or char_length(notes) <= 2000),
  -- Money handed in at the end of the night.
  cash_in numeric(12, 2) check (cash_in is null or cash_in >= 0),
  upi_in numeric(12, 2) check (upi_in is null or upi_in >= 0),
  card_in numeric(12, 2) check (card_in is null or card_in >= 0),
  close_notes text check (close_notes is null or char_length(close_notes) <= 2000),
  closed_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  finance_transaction_id uuid references public.finance_transactions(id) on delete set null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (id, workspace_id),
  -- One kit per show.
  unique (show_id),
  foreign key (show_id, workspace_id) references public.shows (id, workspace_id) on delete set null (show_id)
);
create index if not exists merch_kits_ws_idx on public.merch_kits (workspace_id, status);
create index if not exists merch_kits_lead_idx on public.merch_kits (lead_id);

create table if not exists public.merch_kit_lines (
  kit_id uuid not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  variant_id uuid not null,
  taken integer not null check (taken >= 0),
  -- Show price; null means the usual price.
  price numeric(12, 2) check (price is null or price >= 0),
  -- Filled in when the kit is closed.
  returned integer check (returned is null or returned >= 0),
  given integer not null default 0 check (given >= 0),
  lost integer not null default 0 check (lost >= 0),
  primary key (kit_id, variant_id),
  foreign key (kit_id, workspace_id) references public.merch_kits (id, workspace_id) on delete cascade,
  foreign key (variant_id, workspace_id) references public.merch_variants (id, workspace_id) on delete cascade
);
create index if not exists merch_kit_lines_ws_idx on public.merch_kit_lines (workspace_id);
create index if not exists merch_kit_lines_variant_idx on public.merch_kit_lines (variant_id);

-- Sales and stock moves made from a kit point back at it.
alter table public.merch_sales add column if not exists kit_id uuid;
alter table public.merch_sales drop constraint if exists merch_sales_kit_fkey;
alter table public.merch_sales add constraint merch_sales_kit_fkey foreign key (kit_id, workspace_id) references public.merch_kits (id, workspace_id) on delete cascade;
create index if not exists merch_sales_kit_idx on public.merch_sales (kit_id) where kit_id is not null;

alter table public.merch_stock_moves add column if not exists kit_id uuid;
alter table public.merch_stock_moves drop constraint if exists merch_stock_moves_kit_fkey;
alter table public.merch_stock_moves add constraint merch_stock_moves_kit_fkey foreign key (kit_id, workspace_id) references public.merch_kits (id, workspace_id) on delete cascade;
create index if not exists merch_stock_moves_kit_idx on public.merch_stock_moves (kit_id) where kit_id is not null;

-- ---- Who sees what ---------------------------------------------------------------------------------------------------
-- 'full': owners, admins, Merch role, and members whose Merch section isn't hidden.
-- 'crew': Merch crew (only their own kits). 'none': everyone else.
create or replace function public.merch_scope(ws uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when m.role in ('owner', 'admin') or m.permissions ->> 'merch_manager' = 'true' then 'full'
    when m.permissions ->> 'merch_crew' = 'true' then 'crew'
    when coalesce(m.permissions -> 'sections' ->> 'merch', 'edit') <> 'none' then 'full'
    else 'none'
  end
  from public.workspace_members m
  where m.workspace_id = ws and m.user_id = auth.uid()
  limit 1
$$;
revoke all on function public.merch_scope(uuid) from public, anon;
grant execute on function public.merch_scope(uuid) to authenticated;

-- Can change merch normally (not crew): full scope and Merch section on edit.
create or replace function public.merch_can_edit(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.merch_scope(ws) = 'full' and public.section_level(ws, 'merch') = 'edit'
$$;
revoke all on function public.merch_can_edit(uuid) from public, anon;
grant execute on function public.merch_can_edit(uuid) to authenticated;

-- The signed-in member runs (or helps on) this kit.
create or replace function public.merch_kit_mine(p_kit uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.merch_kits k where k.id = p_kit and (k.lead_id = auth.uid() or auth.uid() = any(k.helper_ids)))
$$;
revoke all on function public.merch_kit_mine(uuid) from public, anon;
grant execute on function public.merch_kit_mine(uuid) to authenticated;

create or replace function public.merch_variant_in_my_kit(p_variant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.merch_kit_lines l join public.merch_kits k on k.id = l.kit_id
     where l.variant_id = p_variant and (k.lead_id = auth.uid() or auth.uid() = any(k.helper_ids))
  )
$$;
revoke all on function public.merch_variant_in_my_kit(uuid) from public, anon;
grant execute on function public.merch_variant_in_my_kit(uuid) to authenticated;

create or replace function public.merch_item_in_my_kit(p_item uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.merch_variants v
      join public.merch_kit_lines l on l.variant_id = v.id
      join public.merch_kits k on k.id = l.kit_id
     where v.item_id = p_item and (k.lead_id = auth.uid() or auth.uid() = any(k.helper_ids))
  )
$$;
revoke all on function public.merch_item_in_my_kit(uuid) from public, anon;
grant execute on function public.merch_item_in_my_kit(uuid) to authenticated;

create or replace function public.merch_kit_status(p_kit uuid)
returns text language sql stable security definer set search_path = public as $$
  select status from public.merch_kits where id = p_kit
$$;
revoke all on function public.merch_kit_status(uuid) from public, anon;
grant execute on function public.merch_kit_status(uuid) to authenticated;

-- ---- Row-level security ----------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  -- New tables get the same member policies as the other merch tables.
  foreach t in array array['merch_kits', 'merch_kit_lines'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists ws_select on public.%I', t);
    execute format('create policy ws_select on public.%I for select to authenticated using (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) <> ''none'')', t);
    execute format('drop policy if exists ws_insert on public.%I', t);
    execute format('create policy ws_insert on public.%I for insert to authenticated with check (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = ''full'')', t);
    execute format('drop policy if exists ws_update on public.%I', t);
    execute format('create policy ws_update on public.%I for update to authenticated using (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = ''full'') with check (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = ''full'')', t);
    execute format('drop policy if exists ws_delete on public.%I', t);
    execute format('create policy ws_delete on public.%I for delete to authenticated using (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = ''full'')', t);
    execute format('revoke all on public.%I from anon', t);
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;

  -- Every merch table: writes need normal edit access (crew go through the functions below); reads are everything
  -- for full scope, and only rows tied to their own kits for crew.
  foreach t in array array['merch_items', 'merch_variants', 'merch_batches', 'merch_sales', 'merch_stock_moves', 'merch_kits', 'merch_kit_lines'] loop
    execute format('drop policy if exists ws_section_read on public.%I', t);
    execute format('create policy ws_section_read on public.%I as restrictive for select to authenticated using (public.merch_scope(workspace_id) = ''full'' or (public.merch_scope(workspace_id) = ''crew'' and %s))', t,
      case t
        when 'merch_items' then 'public.merch_item_in_my_kit(id)'
        when 'merch_variants' then 'public.merch_variant_in_my_kit(id)'
        when 'merch_batches' then 'false'
        when 'merch_sales' then 'kit_id is not null and public.merch_kit_mine(kit_id)'
        when 'merch_stock_moves' then 'kit_id is not null and public.merch_kit_mine(kit_id)'
        when 'merch_kits' then 'public.merch_kit_mine(id)'
        when 'merch_kit_lines' then 'public.merch_kit_mine(kit_id)'
      end);
    execute format('drop policy if exists ws_section_insert on public.%I', t);
    execute format('create policy ws_section_insert on public.%I as restrictive for insert to authenticated with check (public.merch_can_edit(workspace_id))', t);
    execute format('drop policy if exists ws_section_update on public.%I', t);
    execute format('create policy ws_section_update on public.%I as restrictive for update to authenticated using (public.merch_can_edit(workspace_id)) with check (public.merch_can_edit(workspace_id))', t);
    execute format('drop policy if exists ws_section_delete on public.%I', t);
    execute format('create policy ws_section_delete on public.%I as restrictive for delete to authenticated using (public.merch_can_edit(workspace_id))', t);
  end loop;
end $$;

-- Only admins and the Merch role pack, change or delete kits, and an approved kit is locked.
drop policy if exists mk_packers on public.merch_kits;
drop policy if exists mk_pack_insert on public.merch_kits;
create policy mk_pack_insert on public.merch_kits as restrictive for insert to authenticated
  with check (public.merch_approver(workspace_id) and status = 'open' and approved_by is null and finance_transaction_id is null and closed_at is null);
drop policy if exists mk_pack_update on public.merch_kits;
create policy mk_pack_update on public.merch_kits as restrictive for update to authenticated
  using (public.merch_approver(workspace_id) and status = 'open')
  with check (public.merch_approver(workspace_id) and status = 'open' and approved_by is null and finance_transaction_id is null and closed_at is null);
drop policy if exists mk_pack_delete on public.merch_kits;
create policy mk_pack_delete on public.merch_kits as restrictive for delete to authenticated
  using (public.merch_approver(workspace_id) and status <> 'approved');
-- Lines change only while the kit is open; the counts are written by close_merch_kit.
drop policy if exists mkl_packers on public.merch_kit_lines;
drop policy if exists mkl_pack_insert on public.merch_kit_lines;
create policy mkl_pack_insert on public.merch_kit_lines as restrictive for insert to authenticated
  with check (public.merch_approver(workspace_id) and public.merch_kit_status(kit_id) = 'open' and returned is null and given = 0 and lost = 0);
drop policy if exists mkl_pack_update on public.merch_kit_lines;
create policy mkl_pack_update on public.merch_kit_lines as restrictive for update to authenticated
  using (public.merch_approver(workspace_id) and public.merch_kit_status(kit_id) = 'open')
  with check (public.merch_approver(workspace_id) and public.merch_kit_status(kit_id) = 'open' and returned is null and given = 0 and lost = 0);
drop policy if exists mkl_pack_delete on public.merch_kit_lines;
create policy mkl_pack_delete on public.merch_kit_lines as restrictive for delete to authenticated
  using (public.merch_approver(workspace_id) and public.merch_kit_status(kit_id) = 'open');
-- A kit's sales are approved with the kit, never on their own.
drop policy if exists ms_no_kit_writes on public.merch_sales;
create policy ms_no_kit_writes on public.merch_sales as restrictive for insert to authenticated
  with check (kit_id is null);
drop policy if exists msm_no_kit_writes on public.merch_stock_moves;
create policy msm_no_kit_writes on public.merch_stock_moves as restrictive for insert to authenticated
  with check (kit_id is null);

-- ---- The signed-in member's kits, with the show details crew can't otherwise read -------------------------------------
create or replace function public.my_merch_kits(p_ws uuid)
returns table (id uuid, show_id uuid, show_title text, show_date date, venue text, status text, lead_id uuid, helper_ids uuid[], closed_at timestamptz, approved_at timestamptz)
language sql stable security definer set search_path = public as $$
  select k.id, k.show_id, s.title, s.show_date, s.venue, k.status, k.lead_id, k.helper_ids, k.closed_at, k.approved_at
    from public.merch_kits k left join public.shows s on s.id = k.show_id
   where k.workspace_id = p_ws and (k.lead_id = auth.uid() or auth.uid() = any(k.helper_ids))
   order by s.show_date desc nulls last, k.created_at desc
$$;
revoke all on function public.my_merch_kits(uuid) from public, anon;
grant execute on function public.my_merch_kits(uuid) to authenticated;

-- ---- Selling from a kit ----------------------------------------------------------------------------------------------
-- p_lines: [{"variant_id": "...", "qty": 2}, ...]. Never sells more than is left in the box.
create or replace function public.record_kit_sale(p_kit uuid, p_lines jsonb, p_cash numeric default 0, p_upi numeric default 0, p_card numeric default 0, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  k public.merch_kits%rowtype;
  s_date date;
  sale_id uuid;
  r record;
  left_n integer;
  units integer := 0;
begin
  select * into k from public.merch_kits where id = p_kit for update;
  if k.id is null then raise exception 'That kit is no longer there.'; end if;
  if not (public.merch_kit_mine(k.id) or public.merch_can_edit(k.workspace_id)) then raise exception 'You aren’t on this kit.'; end if;
  if public.workspace_access(k.workspace_id) <> 'full' then raise exception 'This workspace is read-only.'; end if;
  if k.status <> 'open' then raise exception 'This kit is closed. Ask an admin to reopen it.'; end if;
  if coalesce(p_cash, 0) < 0 or coalesce(p_upi, 0) < 0 or coalesce(p_card, 0) < 0 then raise exception 'Amounts can’t be negative.'; end if;

  create temp table if not exists _kit_sale_lines (variant_id uuid primary key, qty integer) on commit drop;
  delete from _kit_sale_lines;
  insert into _kit_sale_lines
    select (e ->> 'variant_id')::uuid, sum((e ->> 'qty')::integer)
      from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) e
     where coalesce((e ->> 'qty')::integer, 0) > 0
     group by 1;

  for r in select x.variant_id, x.qty, l.taken from _kit_sale_lines x left join public.merch_kit_lines l on l.kit_id = k.id and l.variant_id = x.variant_id loop
    if r.taken is null then raise exception 'One of those items isn’t in this kit.'; end if;
    select r.taken - coalesce(sum(-m.qty), 0) into left_n from public.merch_stock_moves m where m.kit_id = k.id and m.variant_id = r.variant_id and m.reason = 'sale';
    if r.qty > left_n then raise exception 'Only % of one of those items left in the kit.', greatest(left_n, 0); end if;
    units := units + r.qty;
  end loop;
  if units = 0 and coalesce(p_cash, 0) + coalesce(p_upi, 0) + coalesce(p_card, 0) = 0 then raise exception 'Add what was sold.'; end if;

  select show_date into s_date from public.shows where id = k.show_id;
  insert into public.merch_sales (workspace_id, show_id, kit_id, date, mode, cash_amount, upi_amount, card_amount, held_by, notes)
  values (k.workspace_id, k.show_id, k.id, coalesce(s_date, current_date), 'stall', coalesce(p_cash, 0), coalesce(p_upi, 0), coalesce(p_card, 0), auth.uid(), left(nullif(btrim(p_notes), ''), 2000))
  returning id into sale_id;

  insert into public.merch_stock_moves (workspace_id, variant_id, qty, reason, unit_price, show_id, sale_id, kit_id, date)
  select k.workspace_id, x.variant_id, -x.qty, 'sale', coalesce(l.price, v.price, i.price), k.show_id, sale_id, k.id, coalesce(s_date, current_date)
    from _kit_sale_lines x
    join public.merch_kit_lines l on l.kit_id = k.id and l.variant_id = x.variant_id
    join public.merch_variants v on v.id = x.variant_id
    join public.merch_items i on i.id = v.item_id;

  return sale_id;
end $$;
revoke all on function public.record_kit_sale(uuid, jsonb, numeric, numeric, numeric, text) from public, anon;
grant execute on function public.record_kit_sale(uuid, jsonb, numeric, numeric, numeric, text) to authenticated;

-- Takes back a sale (tapped by mistake) while the kit is still open.
create or replace function public.undo_kit_sale(p_sale uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s public.merch_sales%rowtype;
begin
  select * into s from public.merch_sales where id = p_sale for update;
  if s.id is null or s.kit_id is null then raise exception 'That sale is no longer there.'; end if;
  if public.merch_kit_status(s.kit_id) <> 'open' or s.status <> 'pending' then raise exception 'This kit is closed. Ask an admin to reopen it.'; end if;
  if not (s.created_by = auth.uid() or public.merch_can_edit(s.workspace_id)) then raise exception 'Only the person who recorded this sale can undo it.'; end if;
  delete from public.merch_sales where id = s.id;
end $$;
revoke all on function public.undo_kit_sale(uuid) from public, anon;
grant execute on function public.undo_kit_sale(uuid) to authenticated;

-- ---- Closing a kit ---------------------------------------------------------------------------------------------------
-- p_counts: [{"variant_id": "...", "returned": 3, "given": 1, "lost": 0}, ...] for every item in the kit.
-- Units that went out, weren't tapped as sold, and didn't come back, get given away or lost are recorded as sold
-- in one "count" sale. Its money is whatever was handed in beyond the tapped sales.
create or replace function public.close_merch_kit(p_kit uuid, p_counts jsonb, p_cash numeric, p_upi numeric, p_card numeric, p_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  k public.merch_kits%rowtype;
  s_date date;
  r record;
  c jsonb;
  tapped integer;
  rest integer;
  count_sale uuid;
  t_cash numeric; t_upi numeric; t_card numeric;
begin
  select * into k from public.merch_kits where id = p_kit for update;
  if k.id is null then raise exception 'That kit is no longer there.'; end if;
  if not (public.merch_kit_mine(k.id) or public.merch_can_edit(k.workspace_id)) then raise exception 'You aren’t on this kit.'; end if;
  if k.status <> 'open' then raise exception 'This kit is already closed.'; end if;
  if coalesce(p_cash, 0) < 0 or coalesce(p_upi, 0) < 0 or coalesce(p_card, 0) < 0 then raise exception 'Amounts can’t be negative.'; end if;
  select show_date into s_date from public.shows where id = k.show_id;

  create temp table if not exists _kit_close (variant_id uuid primary key, sold integer) on commit drop;
  delete from _kit_close;

  for r in select * from public.merch_kit_lines where kit_id = k.id loop
    select e into c from jsonb_array_elements(coalesce(p_counts, '[]'::jsonb)) e where (e ->> 'variant_id')::uuid = r.variant_id limit 1;
    if c is null or c ->> 'returned' is null then raise exception 'Count how many came back of every item.'; end if;
    if (c ->> 'returned')::integer < 0 or coalesce((c ->> 'given')::integer, 0) < 0 or coalesce((c ->> 'lost')::integer, 0) < 0 then
      raise exception 'Counts can’t be negative.';
    end if;
    select coalesce(sum(-m.qty), 0) into tapped from public.merch_stock_moves m where m.kit_id = k.id and m.variant_id = r.variant_id and m.reason = 'sale';
    rest := r.taken - tapped - (c ->> 'returned')::integer - coalesce((c ->> 'given')::integer, 0) - coalesce((c ->> 'lost')::integer, 0);
    if rest < 0 then raise exception 'More counted than went out for one of the items (% went, % already sold).', r.taken, tapped; end if;
    update public.merch_kit_lines
       set returned = (c ->> 'returned')::integer, given = coalesce((c ->> 'given')::integer, 0), lost = coalesce((c ->> 'lost')::integer, 0)
     where kit_id = k.id and variant_id = r.variant_id;
    if rest > 0 then insert into _kit_close values (r.variant_id, rest); end if;
  end loop;

  select coalesce(sum(cash_amount), 0), coalesce(sum(upi_amount), 0), coalesce(sum(card_amount), 0)
    into t_cash, t_upi, t_card from public.merch_sales where kit_id = k.id;

  if exists (select 1 from _kit_close) or greatest(coalesce(p_cash, 0) - t_cash, 0) + greatest(coalesce(p_upi, 0) - t_upi, 0) + greatest(coalesce(p_card, 0) - t_card, 0) > 0 then
    insert into public.merch_sales (workspace_id, show_id, kit_id, date, mode, cash_amount, upi_amount, card_amount, held_by, notes)
    values (k.workspace_id, k.show_id, k.id, coalesce(s_date, current_date), 'count',
            greatest(coalesce(p_cash, 0) - t_cash, 0), greatest(coalesce(p_upi, 0) - t_upi, 0), greatest(coalesce(p_card, 0) - t_card, 0),
            auth.uid(), 'Counted at close')
    returning id into count_sale;
    insert into public.merch_stock_moves (workspace_id, variant_id, qty, reason, unit_price, show_id, sale_id, kit_id, date)
    select k.workspace_id, x.variant_id, -x.sold, 'sale', coalesce(l.price, v.price, i.price), k.show_id, count_sale, k.id, coalesce(s_date, current_date)
      from _kit_close x
      join public.merch_kit_lines l on l.kit_id = k.id and l.variant_id = x.variant_id
      join public.merch_variants v on v.id = x.variant_id
      join public.merch_items i on i.id = v.item_id;
  end if;

  update public.merch_kits
     set status = 'closed', cash_in = coalesce(p_cash, 0), upi_in = coalesce(p_upi, 0), card_in = coalesce(p_card, 0),
         close_notes = left(nullif(btrim(p_notes), ''), 2000), closed_by = auth.uid(), closed_at = now()
   where id = k.id;
end $$;
revoke all on function public.close_merch_kit(uuid, jsonb, numeric, numeric, numeric, text) from public, anon;
grant execute on function public.close_merch_kit(uuid, jsonb, numeric, numeric, numeric, text) to authenticated;

-- Undoes a close (wrong count): drops the close-out sale and the counts, and opens the kit again.
create or replace function public.reopen_merch_kit(p_kit uuid)
returns void language plpgsql security definer set search_path = public as $$
declare k public.merch_kits%rowtype;
begin
  select * into k from public.merch_kits where id = p_kit for update;
  if k.id is null then raise exception 'That kit is no longer there.'; end if;
  if not public.merch_approver(k.workspace_id) then raise exception 'Only an admin or someone with the Merch role can reopen a kit.'; end if;
  if k.status <> 'closed' then raise exception 'Only a closed kit can be reopened.'; end if;
  delete from public.merch_sales where kit_id = k.id and mode = 'count';
  update public.merch_kit_lines set returned = null, given = 0, lost = 0 where kit_id = k.id;
  update public.merch_kits set status = 'open', cash_in = null, upi_in = null, card_in = null, close_notes = null, closed_by = null, closed_at = null where id = k.id;
end $$;
revoke all on function public.reopen_merch_kit(uuid) from public, anon;
grant execute on function public.reopen_merch_kit(uuid) to authenticated;

-- ---- Approving a kit -------------------------------------------------------------------------------------------------
-- One Finance income entry for the money handed in, giveaways and losses taken off stock, and the kit locked.
create or replace function public.approve_merch_kit(p_kit uuid, p_member uuid default null, p_account uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  k public.merch_kits%rowtype;
  s_title text; s_date date; s_split timestamptz;
  total numeric;
  holder uuid;
  new_id uuid;
begin
  select * into k from public.merch_kits where id = p_kit for update;
  if k.id is null then raise exception 'That kit is no longer there.'; end if;
  if not public.merch_approver(k.workspace_id) then raise exception 'Only an admin or someone with the Merch role can approve merch takings.'; end if;
  if k.status <> 'closed' then raise exception 'Close the kit before approving it.'; end if;
  if p_member is not null and p_account is not null then raise exception 'The money goes to a person or an account, not both.'; end if;
  if p_member is not null and not exists (select 1 from public.workspace_members m where m.workspace_id = k.workspace_id and m.user_id = p_member) then
    raise exception 'That person isn’t in this workspace.';
  end if;
  if p_account is not null and not exists (select 1 from public.finance_accounts a where a.id = p_account and a.workspace_id = k.workspace_id and a.archived_at is null) then
    raise exception 'That account isn’t available.';
  end if;

  select title, show_date, split_at into s_title, s_date, s_split from public.shows where id = k.show_id;
  total := coalesce(k.cash_in, 0) + coalesce(k.upi_in, 0) + coalesce(k.card_in, 0);

  if total > 0 then
    holder := case when p_account is null then coalesce(p_member, k.lead_id, auth.uid()) end;
    if holder is not null and not exists (select 1 from public.workspace_members m where m.workspace_id = k.workspace_id and m.user_id = holder) then
      holder := auth.uid();
    end if;
    insert into public.finance_transactions (workspace_id, member_id, account_id, amount, description, category, show_id, date, recorded_by)
    values (k.workspace_id, holder, p_account, total,
            left('Merch sales at ' || coalesce(s_title, 'a show') || case when s_split is not null then ' (show already split)' else '' end, 300),
            'merch', case when s_split is null then k.show_id end, coalesce(s_date, current_date), auth.uid())
    returning id into new_id;
  end if;

  insert into public.merch_stock_moves (workspace_id, variant_id, qty, reason, show_id, kit_id, note, date)
  select k.workspace_id, l.variant_id, -l.given, 'giveaway', k.show_id, k.id, 'Given away at the show', coalesce(s_date, current_date)
    from public.merch_kit_lines l where l.kit_id = k.id and l.given > 0;
  insert into public.merch_stock_moves (workspace_id, variant_id, qty, reason, show_id, kit_id, note, date)
  select k.workspace_id, l.variant_id, -l.lost, 'damaged', k.show_id, k.id, 'Missing after the show', coalesce(s_date, current_date)
    from public.merch_kit_lines l where l.kit_id = k.id and l.lost > 0;

  update public.merch_sales set status = 'approved', approved_by = auth.uid(), approved_at = now(), finance_transaction_id = new_id where kit_id = k.id;
  update public.merch_kits set status = 'approved', approved_by = auth.uid(), approved_at = now(), finance_transaction_id = new_id where id = k.id;
  return new_id;
end $$;
revoke all on function public.approve_merch_kit(uuid, uuid, uuid) from public, anon;
grant execute on function public.approve_merch_kit(uuid, uuid, uuid) to authenticated;

-- Kit sales are approved with their kit, so the per-show approval skips them.
create or replace function public.approve_merch_sales(p_ids uuid[], p_member uuid default null, p_account uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  ws uuid;
  shows_n integer;
  sale_show uuid;
  total numeric;
  last_date date;
  first_holder uuid;
  s_title text;
  s_date date;
  s_split timestamptz;
  holder uuid;
  descr text;
  new_id uuid;
  n integer;
begin
  if p_ids is null or cardinality(p_ids) = 0 then raise exception 'Pick at least one sale to approve.'; end if;
  if p_member is not null and p_account is not null then raise exception 'The money goes to a person or an account, not both.'; end if;

  perform 1 from public.merch_sales where id = any(p_ids) for update;

  select count(*), min(workspace_id::text)::uuid, count(distinct coalesce(show_id::text, '-'))
    into n, ws, shows_n
    from public.merch_sales where id = any(p_ids);
  if n <> cardinality(p_ids) then raise exception 'Some of those sales are no longer there.'; end if;
  if (select count(distinct workspace_id) from public.merch_sales where id = any(p_ids)) <> 1 then raise exception 'Those sales are from different workspaces.'; end if;
  if not public.merch_approver(ws) then raise exception 'Only an admin or someone with the Merch role can approve merch takings.'; end if;
  if exists (select 1 from public.merch_sales where id = any(p_ids) and kit_id is not null) then raise exception 'Kit sales are approved with their kit.'; end if;
  if exists (select 1 from public.merch_sales where id = any(p_ids) and status <> 'pending') then raise exception 'Some of those sales are already approved.'; end if;
  if shows_n <> 1 then raise exception 'Approve one show’s sales at a time.'; end if;

  select min(show_id::text)::uuid, coalesce(sum(cash_amount + upi_amount + card_amount), 0), max(date)
    into sale_show, total, last_date
    from public.merch_sales where id = any(p_ids);
  select held_by into first_holder from public.merch_sales where id = any(p_ids) and held_by is not null order by date, created_at limit 1;

  if p_member is not null and not exists (select 1 from public.workspace_members m where m.workspace_id = ws and m.user_id = p_member) then
    raise exception 'That person isn’t in this workspace.';
  end if;
  if p_account is not null and not exists (select 1 from public.finance_accounts a where a.id = p_account and a.workspace_id = ws and a.archived_at is null) then
    raise exception 'That account isn’t available.';
  end if;

  if total > 0 then
    if sale_show is not null then
      select title, show_date, split_at into s_title, s_date, s_split from public.shows where id = sale_show;
    end if;
    holder := case when p_account is null then coalesce(p_member, first_holder, auth.uid()) end;
    if holder is not null and not exists (select 1 from public.workspace_members m where m.workspace_id = ws and m.user_id = holder) then
      holder := auth.uid();
    end if;
    descr := left('Merch sales' || coalesce(' at ' || s_title, '') || case when s_split is not null then ' (show already split)' else '' end, 300);

    insert into public.finance_transactions (workspace_id, member_id, account_id, amount, description, category, show_id, date, recorded_by)
    values (ws, holder, p_account, total, descr, 'merch',
            case when s_split is null then sale_show end,
            coalesce(s_date, last_date, current_date), auth.uid())
    returning id into new_id;
  end if;

  update public.merch_sales
     set status = 'approved', approved_by = auth.uid(), approved_at = now(), finance_transaction_id = new_id
   where id = any(p_ids);

  return new_id;
end $$;

-- Grants: Supabase no longer opens new tables to the API on its own (from 2026-10-30), so say who may reach them.
-- Row-level security above still decides which rows; logged-out visitors get nothing.
grant select, insert, update, delete on public.merch_kits to authenticated;
grant select, insert, update, delete on public.merch_kits to service_role;
grant select, insert, update, delete on public.merch_kit_lines to authenticated;
grant select, insert, update, delete on public.merch_kit_lines to service_role;

commit;
