-- Merch sales wait for approval before any money reaches Finance.
--
-- Recording a sale takes the stock out straight away (it physically left the box), but the takings sit on the
-- sale as "pending". A merch approver (owner, admin, or a member given the Merch role) approves one show's sales
-- together: that makes ONE Finance income entry (category "merch") for the show and locks those sales.
-- Turning a sale down deletes it, which puts its stock back.
--
--   merch_approver(ws)                          owner, admin or Merch-role member of ws
--   approve_merch_sales(ids, member, account)   approves pending sales of one show and writes the Finance entry
--
-- Additive and safe to re-run.

begin;

alter table public.merch_sales add column if not exists status text not null default 'pending';
alter table public.merch_sales drop constraint if exists merch_sales_status_check;
alter table public.merch_sales add constraint merch_sales_status_check check (status in ('pending', 'approved'));
alter table public.merch_sales add column if not exists approved_by uuid references auth.users(id) on delete set null;
alter table public.merch_sales add column if not exists approved_at timestamptz;
create index if not exists merch_sales_pending_idx on public.merch_sales (workspace_id) where status = 'pending';

-- A sale's stock always belongs to a sale.
alter table public.merch_stock_moves drop constraint if exists merch_stock_moves_sale_needs_sale;
alter table public.merch_stock_moves add constraint merch_stock_moves_sale_needs_sale check (reason <> 'sale' or sale_id is not null);

-- ---- Who approves ----------------------------------------------------------------------------------------------------
create or replace function public.merch_approver(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members m
     where m.workspace_id = ws and m.user_id = auth.uid()
       and (m.role in ('owner', 'admin') or m.permissions ->> 'merch_manager' = 'true')
  )
$$;
revoke all on function public.merch_approver(uuid) from public, anon;
grant execute on function public.merch_approver(uuid) to authenticated;

-- A sale that can still be changed: it exists and hasn't been approved.
create or replace function public.merch_sale_open(p_sale uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.merch_sales s where s.id = p_sale and s.status = 'pending')
$$;
revoke all on function public.merch_sale_open(uuid) from public, anon;
grant execute on function public.merch_sale_open(uuid) to authenticated;

-- ---- Approved sales are locked ---------------------------------------------------------------------------------------
-- Sales are only ever saved as pending; approve_merch_sales (below) is the only way to approve one.
drop policy if exists ms_pending_insert on public.merch_sales;
create policy ms_pending_insert on public.merch_sales as restrictive for insert to authenticated
  with check (status = 'pending' and approved_by is null and approved_at is null and finance_transaction_id is null);
drop policy if exists ms_pending_update on public.merch_sales;
create policy ms_pending_update on public.merch_sales as restrictive for update to authenticated
  using (status = 'pending')
  with check (status = 'pending' and approved_by is null and approved_at is null and finance_transaction_id is null);
-- An approved sale can only be removed by an approver (its Finance entry stays; delete that in Finance if needed).
drop policy if exists ms_locked_delete on public.merch_sales;
create policy ms_locked_delete on public.merch_sales as restrictive for delete to authenticated
  using (status = 'pending' or public.merch_approver(workspace_id));

-- The stock lines of an approved sale are locked with it.
drop policy if exists msm_sale_insert on public.merch_stock_moves;
create policy msm_sale_insert on public.merch_stock_moves as restrictive for insert to authenticated
  with check (sale_id is null or public.merch_sale_open(sale_id));
drop policy if exists msm_sale_update on public.merch_stock_moves;
create policy msm_sale_update on public.merch_stock_moves as restrictive for update to authenticated
  using (sale_id is null or public.merch_sale_open(sale_id))
  with check (sale_id is null or public.merch_sale_open(sale_id));
drop policy if exists msm_sale_delete on public.merch_stock_moves;
create policy msm_sale_delete on public.merch_stock_moves as restrictive for delete to authenticated
  using (sale_id is null or public.merch_sale_open(sale_id) or public.merch_approver(workspace_id));

-- ---- Approving -------------------------------------------------------------------------------------------------------
-- Approves pending sales that all belong to the same show (or all to no show) and writes one Finance income entry
-- for their total, held by p_member or p_account (neither: whoever held the money on the first sale, else the approver).
-- If the show has already been split, the entry goes in without the show so the split stays closed.
-- Returns the Finance entry's id, or null when the takings were zero.
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
    -- Only keep a holder who is still in the workspace.
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
revoke all on function public.approve_merch_sales(uuid[], uuid, uuid) from public, anon;
grant execute on function public.approve_merch_sales(uuid[], uuid, uuid) to authenticated;

commit;
