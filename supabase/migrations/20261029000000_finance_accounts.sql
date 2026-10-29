-- Finance accounts: a workspace can track real accounts (a band bank account, a cash box) next to members.
-- An account is just another place a balance lives: an entry belongs to a member's pocket OR to an account.
-- Off unless the workspace turns on the "Band accounts" feature in Money settings (settings -> finance -> features).
-- Additive and safe to re-run.

begin;

create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  kind text not null default 'bank' check (kind in ('bank', 'cash')),
  -- Who the account is in the name of or who carries it; null means the band itself. Information only.
  held_by uuid references auth.users(id) on delete set null,
  upi_id text check (upi_id is null or char_length(upi_id) <= 80),
  archived_at timestamptz,
  position double precision not null default 0,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  -- Lets other tables point at (id, workspace_id) so an entry can never use another workspace's account.
  unique (id, workspace_id)
);
create unique index if not exists finance_accounts_name_idx on public.finance_accounts (workspace_id, lower(btrim(name))) where archived_at is null;
create index if not exists finance_accounts_ws_idx on public.finance_accounts (workspace_id);

-- At most 5 accounts that aren't archived, per workspace. The lock stops two people adding the 5th and 6th at once.
create or replace function public.finance_accounts_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.archived_at is null then
    perform pg_advisory_xact_lock(hashtext(new.workspace_id::text));
    if (select count(*) from public.finance_accounts a
         where a.workspace_id = new.workspace_id and a.archived_at is null and a.id <> new.id) >= 5 then
      raise exception 'A workspace can have up to 5 accounts. Archive one to add another.';
    end if;
  end if;
  return new;
end
$$;
drop trigger if exists finance_accounts_limit on public.finance_accounts;
create trigger finance_accounts_limit before insert or update of archived_at on public.finance_accounts
  for each row execute function public.finance_accounts_limit();

alter table public.finance_accounts enable row level security;

-- Everyone who can see Finance sees the accounts; only owners and admins change them.
drop policy if exists ws_select on public.finance_accounts;
create policy ws_select on public.finance_accounts for select to authenticated
  using (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) <> 'none');
drop policy if exists ws_admin_write on public.finance_accounts;
create policy ws_admin_write on public.finance_accounts for all to authenticated
  using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));

drop policy if exists ws_section_read on public.finance_accounts;
create policy ws_section_read on public.finance_accounts as restrictive for select to authenticated
  using (public.section_level(workspace_id, 'finance') <> 'none');
drop policy if exists ws_section_insert on public.finance_accounts;
create policy ws_section_insert on public.finance_accounts as restrictive for insert to authenticated
  with check (public.section_level(workspace_id, 'finance') = 'edit');
drop policy if exists ws_section_update on public.finance_accounts;
create policy ws_section_update on public.finance_accounts as restrictive for update to authenticated
  using (public.section_level(workspace_id, 'finance') = 'edit') with check (public.section_level(workspace_id, 'finance') = 'edit');
drop policy if exists ws_section_delete on public.finance_accounts;
create policy ws_section_delete on public.finance_accounts as restrictive for delete to authenticated
  using (public.section_level(workspace_id, 'finance') = 'edit');

revoke all on public.finance_accounts from anon;

-- Entries and waiting entries can belong to an account instead of a member. The reference blocks deleting an
-- account that has entries (archive it instead).
alter table public.finance_transactions add column if not exists account_id uuid;
alter table public.finance_requests add column if not exists account_id uuid;

alter table public.finance_transactions drop constraint if exists finance_transactions_account_fkey;
alter table public.finance_transactions add constraint finance_transactions_account_fkey
  foreign key (account_id, workspace_id) references public.finance_accounts (id, workspace_id);
alter table public.finance_requests drop constraint if exists finance_requests_account_fkey;
alter table public.finance_requests add constraint finance_requests_account_fkey
  foreign key (account_id, workspace_id) references public.finance_accounts (id, workspace_id) on delete cascade;

alter table public.finance_transactions drop constraint if exists finance_transactions_one_holder;
alter table public.finance_transactions add constraint finance_transactions_one_holder check (not (member_id is not null and account_id is not null));
alter table public.finance_requests drop constraint if exists finance_requests_one_holder;
alter table public.finance_requests add constraint finance_requests_one_holder check (not (member_id is not null and account_id is not null));

create index if not exists finance_transactions_account_idx on public.finance_transactions (account_id) where account_id is not null;

-- New entries can't go into an archived account (old ones stay where they are).
create or replace function public.finance_transactions_check_account() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.account_id is not null and (tg_op = 'INSERT' or new.account_id is distinct from old.account_id) then
    if exists (select 1 from public.finance_accounts a where a.id = new.account_id and a.archived_at is not null) then
      raise exception 'That account is archived.';
    end if;
  end if;
  return new;
end
$$;
drop trigger if exists finance_transactions_check_account on public.finance_transactions;
create trigger finance_transactions_check_account before insert or update of account_id on public.finance_transactions
  for each row execute function public.finance_transactions_check_account();

-- Approving a waiting entry keeps its account. (Same as before, plus account_id.)
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

  insert into public.finance_transactions (workspace_id, member_id, account_id, amount, description, category, show_id, budget_id, project_id, tags, date, recorded_by)
  values (r.workspace_id,
          case when r.account_id is null then coalesce(r.member_id, r.submitted_by) end,
          r.account_id, r.amount, r.description, r.category, r.show_id, r.budget_id, r.project_id, r.tags, r.date, r.submitted_by)
  returning id into new_id;

  delete from public.finance_requests where id = p_id;
  return new_id;
end $$;
revoke all on function public.approve_finance_request(uuid) from public, anon;
grant execute on function public.approve_finance_request(uuid) to authenticated;

-- Account changes go in the audit log like every other finance change.
drop trigger if exists finance_accounts_audit on public.finance_accounts;
create trigger finance_accounts_audit after insert or update or delete on public.finance_accounts
  for each row execute function public.finance_audit_row();

-- Grants: Supabase no longer opens new tables to the API on its own (from 2026-10-30), so say who may reach them.
-- Row-level security above still decides which rows; logged-out visitors get nothing.
grant select, insert, update, delete on public.finance_accounts to authenticated;
grant select, insert, update, delete on public.finance_accounts to service_role;

commit;
