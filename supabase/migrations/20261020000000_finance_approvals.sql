-- Treasurer approval for finance entries. Off by default (Money settings -> Extra tools).
-- When it's on, entries added by anyone who isn't an admin or treasurer wait in finance_requests and
-- count nowhere until approved. Additive and safe to re-run.
--
--   finance_approver(ws)                 owner, admin or treasurer of ws
--   finance_approvals_on(ws)             whether the workspace has approval switched on
--   finance_requests                     entries waiting for approval
--   approve_finance_request(p_id)        moves one waiting entry into finance_transactions
--   approve_all_finance_requests(p_ws)   approves everything waiting (used when approval is switched off)

begin;

create or replace function public.finance_approver(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members m
     where m.workspace_id = ws and m.user_id = auth.uid()
       and (m.role in ('owner', 'admin') or m.permissions ->> 'treasurer' = 'true')
  )
$$;
revoke all on function public.finance_approver(uuid) from public, anon;
grant execute on function public.finance_approver(uuid) to authenticated;

create or replace function public.finance_approvals_on(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select w.settings -> 'finance' -> 'features' ->> 'approvals' = 'true' from public.workspaces w where w.id = ws), false)
$$;
revoke all on function public.finance_approvals_on(uuid) from public, anon;
grant execute on function public.finance_approvals_on(uuid) to authenticated;

-- Entries waiting for approval ---------------------------------------------------------

create table if not exists public.finance_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  submitted_by uuid not null default auth.uid(),
  member_id uuid,
  amount numeric not null check (amount <> 0),
  description text not null check (char_length(description) between 1 and 300),
  category text,
  show_id uuid references public.shows(id) on delete cascade,
  budget_id uuid,
  project_id uuid references public.finance_projects(id) on delete set null,
  tags text[] not null default '{}',
  date date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists finance_requests_ws_idx on public.finance_requests (workspace_id);

alter table public.finance_requests enable row level security;

-- The person who sent it sees their own; admins and treasurers see all of them.
drop policy if exists fr_select on public.finance_requests;
create policy fr_select on public.finance_requests for select to authenticated
  using (public.is_workspace_member(workspace_id) and (submitted_by = auth.uid() or public.finance_approver(workspace_id)));

drop policy if exists fr_insert on public.finance_requests;
create policy fr_insert on public.finance_requests for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = 'full'
    and public.section_level(workspace_id, 'finance') = 'edit' and submitted_by = auth.uid());

drop policy if exists fr_update on public.finance_requests;
create policy fr_update on public.finance_requests for update to authenticated
  using (public.is_workspace_member(workspace_id) and submitted_by = auth.uid())
  with check (public.is_workspace_member(workspace_id) and submitted_by = auth.uid());

-- Withdrawing your own, or an admin/treasurer turning one down.
drop policy if exists fr_delete on public.finance_requests;
create policy fr_delete on public.finance_requests for delete to authenticated
  using (public.is_workspace_member(workspace_id) and (submitted_by = auth.uid() or public.finance_approver(workspace_id)));

revoke all on public.finance_requests from anon;

-- With approval on, only admins and treasurers write entries directly ----------------------
-- Payouts from splits (marking a split payment paid) stay open to everyone: the split itself was the treasurer's call.

drop policy if exists ws_approval_insert on public.finance_transactions;
create policy ws_approval_insert on public.finance_transactions as restrictive for insert to authenticated
  with check (not public.finance_approvals_on(workspace_id) or public.finance_approver(workspace_id)
    or category in ('split', 'balance_reimbursement'));

drop policy if exists ws_approval_update on public.finance_transactions;
create policy ws_approval_update on public.finance_transactions as restrictive for update to authenticated
  using (not public.finance_approvals_on(workspace_id) or public.finance_approver(workspace_id));

drop policy if exists ws_approval_delete on public.finance_transactions;
create policy ws_approval_delete on public.finance_transactions as restrictive for delete to authenticated
  using (not public.finance_approvals_on(workspace_id) or public.finance_approver(workspace_id));

-- Approving --------------------------------------------------------------------------------

create or replace function public.approve_finance_request(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  r public.finance_requests%rowtype;
  new_id uuid;
begin
  select * into r from public.finance_requests where id = p_id for update;
  if r.id is null then raise exception 'That entry is no longer waiting'; end if;
  if not public.finance_approver(r.workspace_id) then raise exception 'Only an admin or treasurer can approve entries'; end if;
  if r.show_id is not null and exists (select 1 from public.shows s where s.id = r.show_id and s.split_at is not null) then
    raise exception 'That show has already been split. Ask for it to be added as a general entry instead.';
  end if;

  insert into public.finance_transactions (workspace_id, member_id, amount, description, category, show_id, budget_id, project_id, tags, date, recorded_by)
  values (r.workspace_id, coalesce(r.member_id, r.submitted_by), r.amount, r.description, r.category, r.show_id, r.budget_id, r.project_id, r.tags, r.date, r.submitted_by)
  returning id into new_id;

  delete from public.finance_requests where id = p_id;
  return new_id;
end $$;
revoke all on function public.approve_finance_request(uuid) from public, anon;
grant execute on function public.approve_finance_request(uuid) to authenticated;

create or replace function public.approve_all_finance_requests(p_ws uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  r record;
  n integer := 0;
begin
  if not public.finance_approver(p_ws) then raise exception 'Only an admin or treasurer can approve entries'; end if;
  for r in select id, show_id from public.finance_requests where workspace_id = p_ws order by created_at loop
    -- An entry for a show that has since been split can't be added to it; leave it for someone to sort out.
    if r.show_id is not null and exists (select 1 from public.shows s where s.id = r.show_id and s.split_at is not null) then
      continue;
    end if;
    perform public.approve_finance_request(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.approve_all_finance_requests(uuid) from public, anon;
grant execute on function public.approve_all_finance_requests(uuid) to authenticated;

-- Grants: Supabase no longer opens new tables to the API on its own (from 2026-10-30), so say who may reach them.
-- Row-level security above still decides which rows; logged-out visitors get nothing.
grant select, insert, update, delete on public.finance_requests to authenticated;
grant select, insert, update, delete on public.finance_requests to service_role;

commit;
