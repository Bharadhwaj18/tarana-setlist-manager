-- Band accounts are run by admins and treasurers. Everyone else can still ask for an entry in an account, and that
-- always waits for approval (even when treasurer approval is off). Additive and safe to re-run.

begin;

-- Entries in an account, and both sides of a move, can only be added, changed or removed by an owner, admin or treasurer.
drop policy if exists ws_account_insert on public.finance_transactions;
create policy ws_account_insert on public.finance_transactions as restrictive for insert to authenticated
  with check (account_id is null or public.finance_approver(workspace_id));
drop policy if exists ws_account_update on public.finance_transactions;
create policy ws_account_update on public.finance_transactions as restrictive for update to authenticated
  using ((account_id is null and transfer_id is null) or public.finance_approver(workspace_id))
  with check ((account_id is null and transfer_id is null) or public.finance_approver(workspace_id));
drop policy if exists ws_account_delete on public.finance_transactions;
create policy ws_account_delete on public.finance_transactions as restrictive for delete to authenticated
  using ((account_id is null and transfer_id is null) or public.finance_approver(workspace_id));

-- Switching treasurer approval off approves what's waiting, except requests for an account, which always wait.
create or replace function public.approve_all_finance_requests(p_ws uuid)
returns integer language plpgsql security definer set search_path = public as $fn$
declare
  r record;
  n integer := 0;
begin
  if not public.finance_approver(p_ws) then raise exception 'Only an admin or treasurer can approve entries'; end if;
  for r in select id, show_id from public.finance_requests where workspace_id = p_ws and account_id is null order by created_at loop
    -- An entry for a show that has since been split can't be added to it; leave it for someone to sort out.
    if r.show_id is not null and exists (select 1 from public.shows s where s.id = r.show_id and s.split_at is not null) then
      continue;
    end if;
    perform public.approve_finance_request(r.id);
    n := n + 1;
  end loop;
  return n;
end $fn$;
revoke all on function public.approve_all_finance_requests(uuid) from public, anon;
grant execute on function public.approve_all_finance_requests(uuid) to authenticated;

-- Moving money is for admins and treasurers only, whether or not treasurer approval is on.
create or replace function public.move_money(
  p_ws uuid,
  p_from_account uuid, p_from_member uuid,
  p_to_account uuid, p_to_member uuid,
  p_amount numeric, p_from_desc text, p_to_desc text, p_date date default current_date
) returns uuid
language plpgsql security definer set search_path = public as $fn$
declare
  tid uuid := gen_random_uuid();
  amt numeric := round(p_amount, 2);
  who uuid := auth.uid();
begin
  if who is null then raise exception 'Not signed in'; end if;
  if not (public.is_workspace_member(p_ws) and public.workspace_access(p_ws) = 'full'
          and public.section_level(p_ws, 'finance') = 'edit') then
    raise exception 'You can only view money in this workspace, not move it.';
  end if;
  if not public.finance_approver(p_ws) then
    raise exception 'Only an admin or treasurer can move money.';
  end if;

  if (p_from_account is null) = (p_from_member is null) or (p_to_account is null) = (p_to_member is null) then
    raise exception 'Choose where the money comes from and where it goes.';
  end if;
  if p_from_account is null and p_to_account is null then
    raise exception 'A move needs a band account on one side.';
  end if;
  if p_from_account is not distinct from p_to_account and p_from_member is not distinct from p_to_member then
    raise exception 'Choose two different places.';
  end if;
  if amt is null or amt <= 0 then raise exception 'Enter an amount above zero.'; end if;
  if coalesce(char_length(btrim(p_from_desc)), 0) not between 1 and 300 or coalesce(char_length(btrim(p_to_desc)), 0) not between 1 and 300 then
    raise exception 'The note is too long.';
  end if;

  if p_from_account is not null and not exists (select 1 from public.finance_accounts a where a.id = p_from_account and a.workspace_id = p_ws and a.archived_at is null) then
    raise exception 'The account you are moving from is archived or missing.';
  end if;
  if p_to_account is not null and not exists (select 1 from public.finance_accounts a where a.id = p_to_account and a.workspace_id = p_ws and a.archived_at is null) then
    raise exception 'The account you are moving to is archived or missing.';
  end if;
  if p_from_member is not null and not exists (select 1 from public.workspace_members m where m.workspace_id = p_ws and m.user_id = p_from_member) then
    raise exception 'That person is not in this workspace.';
  end if;
  if p_to_member is not null and not exists (select 1 from public.workspace_members m where m.workspace_id = p_ws and m.user_id = p_to_member) then
    raise exception 'That person is not in this workspace.';
  end if;

  insert into public.finance_transactions (workspace_id, member_id, account_id, amount, description, category, date, recorded_by, transfer_id)
  values
    (p_ws, p_from_member, p_from_account, -amt, btrim(p_from_desc), 'transfer', coalesce(p_date, current_date), who, tid),
    (p_ws, p_to_member, p_to_account, amt, btrim(p_to_desc), 'transfer', coalesce(p_date, current_date), who, tid);

  return tid;
end $fn$;
revoke all on function public.move_money(uuid, uuid, uuid, uuid, uuid, numeric, text, text, date) from public, anon;
grant execute on function public.move_money(uuid, uuid, uuid, uuid, uuid, numeric, text, text, date) to authenticated;

commit;
