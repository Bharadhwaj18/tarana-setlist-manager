-- Security lock-down. Closes four holes found in the DB review; safe to re-run.
--
--   1. notifications       was readable/writable by every signed-in user across every workspace.
--                          Now: you read and mark-read only your own; you can only notify people who
--                          share the workspace you're notifying from.
--   2. push_subscriptions  was readable by everyone (device push keys) and re-pointable to anyone.
--                          Now: you only see and remove your own. Saving one goes through
--                          save_push_subscription() so a browser that switches accounts still works.
--                          Sending pushes to other people now happens server-side with the service role.
--   3. finance_expenses / finance_ledger / finance_splits
--                          empty leftovers from the first finance design, open to everyone. Dropped.
--   4. Treasurer approval  could be skipped by inserting any finance entry with category 'split' or
--                          'balance_reimbursement'. That exception existed only so a payer could mark a
--                          split payment paid; that now goes through mark_pending_payment_paid(), and
--                          the approval rule has no category exception.
--
-- Deploy together with the app change that calls save_push_subscription / mark_pending_payment_paid
-- and sends pushes with the service-role client — the old app code breaks against this schema.

begin;

-- 1. notifications -------------------------------------------------------------------------

drop policy if exists "authenticated full access" on public.notifications;

drop policy if exists n_select on public.notifications;
create policy n_select on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));

-- Marking read is the only change a recipient makes; the column grant below keeps it to read_at.
drop policy if exists n_update on public.notifications;
create policy n_update on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

-- Sender is you, you're in the workspace, and so is the recipient. The cron reminders write with the
-- service role and aren't affected.
drop policy if exists n_insert on public.notifications;
create policy n_insert on public.notifications for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.workspace_members m
       where m.workspace_id = notifications.workspace_id and m.user_id = notifications.recipient_id
    )
  );

revoke all on public.notifications from anon;
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- 2. push_subscriptions ---------------------------------------------------------------------

drop policy if exists "authenticated full access" on public.push_subscriptions;

drop policy if exists ps_select on public.push_subscriptions;
create policy ps_select on public.push_subscriptions for select to authenticated
  using (profile_id = (select auth.uid()));

drop policy if exists ps_delete on public.push_subscriptions;
create policy ps_delete on public.push_subscriptions for delete to authenticated
  using (profile_id = (select auth.uid()));

-- No insert/update policy: saving goes through the function below.
revoke all on public.push_subscriptions from anon;
revoke insert, update on public.push_subscriptions from authenticated;

create index if not exists push_subscriptions_profile_idx on public.push_subscriptions (profile_id);

-- An endpoint belongs to one browser. If someone else signed in on this browser before, the
-- endpoint moves to whoever is signed in now. Endpoints are no longer readable by other users, so
-- this can't be used to take over someone else's device.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if coalesce(p_endpoint, '') !~ '^https://' or char_length(p_endpoint) > 1000 then
    raise exception 'Not a valid push endpoint';
  end if;
  insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth)
  values (uid, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set profile_id = excluded.profile_id, p256dh = excluded.p256dh, auth = excluded.auth;
end $$;
revoke all on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

-- 3. Legacy finance tables ------------------------------------------------------------------

do $$
begin
  if to_regclass('public.finance_expenses') is not null and exists (select 1 from public.finance_expenses)
     or to_regclass('public.finance_ledger') is not null and exists (select 1 from public.finance_ledger)
     or to_regclass('public.finance_splits') is not null and exists (select 1 from public.finance_splits) then
    raise exception 'A legacy finance table has rows now — check them before dropping';
  end if;
end $$;

drop table if exists public.finance_splits;
drop table if exists public.finance_ledger;
drop table if exists public.finance_expenses;

-- 4. Treasurer approval without the category exception --------------------------------------

drop policy if exists ws_approval_insert on public.finance_transactions;
create policy ws_approval_insert on public.finance_transactions as restrictive for insert to authenticated
  with check (not public.finance_approvals_on(workspace_id) or public.finance_approver(workspace_id));

-- The payer (or an admin/treasurer) marks a pending payment paid: the debit, the credit for a balance
-- reimbursement, and the paid stamp happen together or not at all.
create or replace function public.mark_pending_payment_paid(p_id uuid, p_date date default current_date)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p public.pending_payments%rowtype;
  txn_id uuid;
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
  if p.from_member <> uid and not public.finance_approver(p.workspace_id) then
    raise exception 'Only the payer (or a treasurer) can mark this paid.';
  end if;

  insert into public.finance_transactions (workspace_id, member_id, amount, description, category, show_id, date, recorded_by)
  values (p.workspace_id, p.from_member, -p.amount, p.description, p.category, p.show_id, p_date, uid)
  returning id into txn_id;

  -- A balance reimbursement isn't a split share: the recipient is credited what the payer hands over.
  if p.category = 'balance_reimbursement' then
    insert into public.finance_transactions (workspace_id, member_id, amount, description, category, show_id, date, recorded_by)
    values (p.workspace_id, p.to_member, p.amount, p.description, p.category, null, p_date, uid);
  end if;

  update public.pending_payments set paid_at = now(), paid_transaction_id = txn_id where id = p_id;
  return txn_id;
end $$;
revoke all on function public.mark_pending_payment_paid(uuid, date) from public, anon;
grant execute on function public.mark_pending_payment_paid(uuid, date) to authenticated;

commit;
