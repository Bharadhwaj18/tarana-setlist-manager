-- Marking a waiting payment paid: the payer, the person being paid, or an admin/treasurer can do it. A payment from
-- an account comes out of that account. paid_by records who tapped it and p_ref an optional UPI or bank reference.

drop function if exists public.mark_pending_payment_paid(uuid, date);

create or replace function public.mark_pending_payment_paid(p_id uuid, p_date date default current_date, p_ref text default null)
returns uuid
language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  p public.pending_payments%rowtype;
  txn_id uuid;
  descr text;
begin
  if uid is null then raise exception 'Not signed in'; end if;

  select * into p from public.pending_payments where id = p_id for update;
  if not found or not public.is_workspace_member(p.workspace_id) then
    raise exception 'This payment no longer exists.';
  end if;
  if p.paid_at is not null then raise exception 'Already marked paid.'; end if;
  if public.workspace_access(p.workspace_id) <> 'full' or public.section_level(p.workspace_id, 'finance') <> 'edit' then
    raise exception 'You can''t change money in this workspace.';
  end if;
  if p.from_member is distinct from uid and p.to_member <> uid and not public.finance_approver(p.workspace_id) then
    raise exception 'Only the payer, the person being paid, or a treasurer can mark this paid.';
  end if;

  descr := p.description || case when nullif(btrim(p_ref), '') is not null then ' · ' || left(btrim(p_ref), 80) else '' end;

  insert into public.finance_transactions (workspace_id, member_id, account_id, amount, description, category, show_id, date, recorded_by)
  values (p.workspace_id, p.from_member, p.from_account, -p.amount, descr, p.category, p.show_id, p_date, uid)
  returning id into txn_id;

  -- A balance reimbursement isn't a split share: the recipient is credited what the payer hands over.
  if p.category = 'balance_reimbursement' then
    insert into public.finance_transactions (workspace_id, member_id, amount, description, category, show_id, date, recorded_by)
    values (p.workspace_id, p.to_member, p.amount, descr, p.category, null, p_date, uid);
  end if;

  update public.pending_payments
    set paid_at = now(), paid_transaction_id = txn_id, paid_by = uid, paid_ref = nullif(left(btrim(p_ref), 80), '')
    where id = p_id;
  return txn_id;
end $fn$;

revoke all on function public.mark_pending_payment_paid(uuid, date, text) from public, anon;
grant execute on function public.mark_pending_payment_paid(uuid, date, text) to authenticated;
