-- Workspaces, phase 3c: ENFORCE. Drops the old "authenticated full access" policies so only the
-- workspace policies (ws_*) remain, and makes workspace_id NOT NULL. After this, a user can only
-- touch rows in workspaces they belong to.
-- Runs in one transaction: if anything errors, nothing is applied.
-- Emergency undo: workspaces_phase3c_rollback.sql restores the old open policies.
-- Requires 3a. Service-role code (the reminder cron) bypasses RLS and is unaffected.

begin;

-- Refuse to proceed if any row has no workspace (the NOT NULL below would fail anyway; this says which).
do $$
declare t text; n bigint;
begin
  foreach t in array array['songs','setlists','shows','event_management','notes','finance_transactions',
                           'pending_payments','budgets','split_runs','calendar_events','unavailability','recordings'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('select count(*) from public.%I where workspace_id is null', t) into n;
    if n > 0 then raise exception 'table % has % rows without a workspace_id; fix before enforcing', t, n; end if;
  end loop;
end $$;

-- Drop every policy on these tables that isn't a ws_* policy.
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
           where schemaname = 'public'
             and tablename in ('songs','setlists','setlist_songs','shows','event_management','notes','note_checklist_items',
                               'finance_transactions','pending_payments','budgets','budget_adjustments','split_runs',
                               'calendar_events','unavailability','recordings')
             and policyname not like 'ws\_%'
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Make sure RLS is actually switched on for every one of them (it should be already).
do $$
declare t text;
begin
  foreach t in array array['songs','setlists','setlist_songs','shows','event_management','notes','note_checklist_items',
                           'finance_transactions','pending_payments','budgets','budget_adjustments','split_runs',
                           'calendar_events','unavailability','recordings'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- workspace_id is now mandatory (the insert trigger still fills it if the app ever omits it).
do $$
declare t text;
begin
  foreach t in array array['songs','setlists','shows','event_management','notes','finance_transactions',
                           'pending_payments','budgets','split_runs','calendar_events','unavailability','recordings'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table public.%I alter column workspace_id set not null', t);
  end loop;
end $$;

commit;

-- Result: every table should list only ws_* policies.
select tablename, string_agg(policyname, ', ' order by policyname) as policies
from pg_policies where schemaname = 'public'
  and tablename in ('songs','setlists','setlist_songs','shows','event_management','notes','note_checklist_items',
                    'finance_transactions','pending_payments','budgets','budget_adjustments','split_runs',
                    'calendar_events','unavailability','recordings')
group by tablename order by tablename;
