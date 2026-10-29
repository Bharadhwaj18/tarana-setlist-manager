-- Bank balance checks: a treasurer or admin records what the bank really shows for an account. We keep what the
-- app expected, the difference, and (if they choose) a correction entry that brings the account in line.
-- Additive and safe to re-run.

begin;

create table if not exists public.finance_account_checks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  account_id uuid not null,
  checked_on date not null default current_date,
  bank_balance numeric(12,2) not null,
  recorded_balance numeric(12,2) not null,
  difference numeric(12,2) not null,
  note text check (note is null or char_length(note) <= 200),
  -- The correction entry made from this check, if any.
  adjustment_id uuid references public.finance_transactions(id) on delete set null,
  checked_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (account_id, workspace_id) references public.finance_accounts (id, workspace_id) on delete cascade
);
create index if not exists finance_account_checks_idx on public.finance_account_checks (account_id, created_at desc);

alter table public.finance_account_checks enable row level security;

-- Anyone who can see Finance can read the checks. Rows are only written by the function below.
drop policy if exists ws_select on public.finance_account_checks;
create policy ws_select on public.finance_account_checks for select to authenticated
  using (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) <> 'none');
drop policy if exists ws_section_read on public.finance_account_checks;
create policy ws_section_read on public.finance_account_checks as restrictive for select to authenticated
  using (public.section_level(workspace_id, 'finance') <> 'none');

revoke all on public.finance_account_checks from anon;
grant select on public.finance_account_checks to authenticated;
grant select, insert, update, delete on public.finance_account_checks to service_role;

-- p_adjust: also add a correction entry for the difference (it counts as neither income nor spending).
-- Returns the difference (bank minus what the app had).
create or replace function public.check_account_balance(
  p_ws uuid, p_account uuid, p_bank numeric, p_date date default current_date, p_note text default null, p_adjust boolean default false
) returns numeric
language plpgsql security definer set search_path = public as $fn$
declare
  who uuid := auth.uid();
  bank numeric := round(p_bank, 2);
  have numeric;
  diff numeric;
  adj uuid;
begin
  if who is null then raise exception 'Not signed in'; end if;
  if not (public.is_workspace_member(p_ws) and public.workspace_access(p_ws) = 'full'
          and public.section_level(p_ws, 'finance') = 'edit') then
    raise exception 'You can only view money in this workspace, not change it.';
  end if;
  if not public.finance_approver(p_ws) then raise exception 'Only an admin or treasurer can check an account.'; end if;
  if bank is null then raise exception 'Enter the balance the bank shows.'; end if;
  if not exists (select 1 from public.finance_accounts a where a.id = p_account and a.workspace_id = p_ws) then
    raise exception 'That account is missing.';
  end if;
  if p_adjust and exists (select 1 from public.finance_accounts a where a.id = p_account and a.archived_at is not null) then
    raise exception 'That account is archived.';
  end if;

  select coalesce(sum(amount), 0) into have from public.finance_transactions where workspace_id = p_ws and account_id = p_account;
  diff := round(bank - have, 2);

  if p_adjust and diff <> 0 then
    insert into public.finance_transactions (workspace_id, member_id, account_id, amount, description, category, date, recorded_by)
    values (p_ws, null, p_account, diff,
            'Balance correction' || case when coalesce(btrim(p_note), '') <> '' then ': ' || left(btrim(p_note), 200) else '' end,
            'correction', coalesce(p_date, current_date), who)
    returning id into adj;
  end if;

  insert into public.finance_account_checks (workspace_id, account_id, checked_on, bank_balance, recorded_balance, difference, note, adjustment_id, checked_by)
  values (p_ws, p_account, coalesce(p_date, current_date), bank, have, diff, nullif(left(btrim(coalesce(p_note, '')), 200), ''), adj, who);

  return diff;
end $fn$;
revoke all on function public.check_account_balance(uuid, uuid, numeric, date, text, boolean) from public, anon;
grant execute on function public.check_account_balance(uuid, uuid, numeric, date, text, boolean) to authenticated;

commit;
