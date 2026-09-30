-- Atomic show split. Replaces five separate writes done from the app (transactions, pending payments,
-- shows.split_at, split_runs) that could leave a half-finished split if any one of them failed.
-- SECURITY INVOKER (default): row level security still applies to every write below.
-- Safe to re-run.

create or replace function public.run_split(
  p_workspace_id uuid,
  p_show_ids uuid[],
  p_payments jsonb,      -- [{from, to, amount, description, fromName, toName}]
  p_run_shows jsonb,     -- frozen per-show summary for Split History
  p_report jsonb,
  p_band_pct numeric,
  p_total_net numeric,
  p_total_band_fund numeric,
  p_today date
) returns uuid
language plpgsql
as $$
declare
  uid uuid := auth.uid();
  is_treasurer boolean;
  locked_count int;
  tag_show uuid := case when cardinality(p_show_ids) = 1 then p_show_ids[1] else null end;
  p jsonb;
  pending_id uuid;
  run_payments jsonb := '[]'::jsonb;
  run_id uuid;
  amt numeric;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select coalesce((permissions ->> 'treasurer')::boolean, false) into is_treasurer
  from public.workspace_members where workspace_id = p_workspace_id and user_id = uid;
  if not coalesce(is_treasurer, false) then raise exception 'Only a treasurer can do this.'; end if;

  if public.workspace_access(p_workspace_id) is distinct from 'full' then
    raise exception 'This workspace is read-only.';
  end if;

  -- Lock the shows so two treasurers cannot split the same show at once.
  select count(*) into locked_count from (
    select id from public.shows
    where id = any(p_show_ids) and workspace_id = p_workspace_id and split_at is null
    for update
  ) s;
  if locked_count <> cardinality(p_show_ids) or cardinality(p_show_ids) = 0 then
    raise exception 'One or more shows are already split or not found.';
  end if;

  for p in select * from jsonb_array_elements(p_payments) loop
    amt := (p ->> 'amount')::numeric;
    continue when amt is null or amt <= 0;

    if (select count(*) from public.workspace_members
        where workspace_id = p_workspace_id and user_id in ((p ->> 'from')::uuid, (p ->> 'to')::uuid))
       <> case when (p ->> 'from') = (p ->> 'to') then 1 else 2 end then
      raise exception 'Payment involves someone who is not in this workspace.';
    end if;

    if (p ->> 'from') = (p ->> 'to') then
      insert into public.finance_transactions (member_id, amount, description, category, show_id, date, recorded_by, workspace_id)
      values ((p ->> 'from')::uuid, -amt, p ->> 'description', 'split', tag_show, p_today, uid, p_workspace_id);
      run_payments := run_payments || jsonb_build_object(
        'from', p ->> 'from', 'to', p ->> 'to', 'fromName', p ->> 'fromName', 'toName', p ->> 'toName',
        'amount', amt, 'kind', 'self');
    else
      insert into public.pending_payments (from_member, to_member, amount, description, category, show_id, workspace_id)
      values ((p ->> 'from')::uuid, (p ->> 'to')::uuid, amt, p ->> 'description', 'split', tag_show, p_workspace_id)
      returning id into pending_id;
      run_payments := run_payments || jsonb_build_object(
        'from', p ->> 'from', 'to', p ->> 'to', 'fromName', p ->> 'fromName', 'toName', p ->> 'toName',
        'amount', amt, 'kind', 'transfer', 'pendingId', pending_id);
    end if;
  end loop;

  update public.shows set split_at = now() where id = any(p_show_ids) and workspace_id = p_workspace_id;

  insert into public.split_runs (created_by, workspace_id, band_pct, total_net, total_band_fund, shows, payments, report)
  values (uid, p_workspace_id, p_band_pct, p_total_net, p_total_band_fund, p_run_shows, run_payments, p_report)
  returning id into run_id;

  return run_id;
end $$;

revoke all on function public.run_split(uuid, uuid[], jsonb, jsonb, jsonb, numeric, numeric, numeric, date) from public, anon;
grant execute on function public.run_split(uuid, uuid[], jsonb, jsonb, jsonb, numeric, numeric, numeric, date) to authenticated;
