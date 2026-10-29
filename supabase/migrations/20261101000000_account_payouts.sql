-- Paying split payouts and reimbursements out of a band account. A waiting payment can now come from an account
-- instead of a member, and either side (the payer, the person being paid, or an admin/treasurer) can mark it paid.
-- Additive and safe to re-run.

begin;

alter table public.pending_payments alter column from_member drop not null;
alter table public.pending_payments add column if not exists from_account uuid;
alter table public.pending_payments add column if not exists paid_by uuid references public.profiles(id);
alter table public.pending_payments add column if not exists paid_ref text;

alter table public.pending_payments drop constraint if exists pending_payments_from_account_fkey;
alter table public.pending_payments add constraint pending_payments_from_account_fkey
  foreign key (from_account, workspace_id) references public.finance_accounts (id, workspace_id);
alter table public.pending_payments drop constraint if exists pending_payments_payer_check;
alter table public.pending_payments add constraint pending_payments_payer_check
  check ((from_member is null) <> (from_account is null));

-- Only an admin or treasurer can ask for a payment out of an account.
drop policy if exists ws_account_payer on public.pending_payments;
create policy ws_account_payer on public.pending_payments as restrictive for insert to authenticated
  with check (from_account is null or public.finance_approver(workspace_id));

commit;
