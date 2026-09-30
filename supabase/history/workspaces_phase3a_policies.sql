-- Workspaces, phase 3a: ADD workspace-based RLS policies next to the existing
-- "authenticated full access" ones. Postgres ORs permissive policies, so as long as the old
-- ones exist NOTHING changes for anyone. Purely additive, safe to re-run.
-- Next: run workspaces_phase3b_dryrun.sql, which proves these policies work (and rolls back).

-- Top-level tables: members of the workspace can read unless it's blocked ('none');
-- writes need full access (so a read_only workspace can still be read/exported, not edited).
do $$
declare
  t text;
begin
  foreach t in array array[
    'songs', 'setlists', 'shows', 'event_management', 'notes', 'finance_transactions',
    'pending_payments', 'budgets', 'split_runs', 'calendar_events', 'unavailability', 'recordings'
  ] loop
    if to_regclass('public.' || t) is null then continue; end if;

    execute format('drop policy if exists ws_select on public.%I', t);
    execute format($p$create policy ws_select on public.%I for select to authenticated
      using (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) <> 'none')$p$, t);

    execute format('drop policy if exists ws_insert on public.%I', t);
    execute format($p$create policy ws_insert on public.%I for insert to authenticated
      with check (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = 'full')$p$, t);

    execute format('drop policy if exists ws_update on public.%I', t);
    execute format($p$create policy ws_update on public.%I for update to authenticated
      using (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = 'full')
      with check (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = 'full')$p$, t);

    execute format('drop policy if exists ws_delete on public.%I', t);
    execute format($p$create policy ws_delete on public.%I for delete to authenticated
      using (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = 'full')$p$, t);
  end loop;
end $$;

-- Child tables inherit their parent's workspace.
-- setlist_songs -> setlists
drop policy if exists ws_select on public.setlist_songs;
create policy ws_select on public.setlist_songs for select to authenticated using (
  exists (select 1 from public.setlists p where p.id = setlist_id
          and public.is_workspace_member(p.workspace_id) and public.workspace_access(p.workspace_id) <> 'none'));
drop policy if exists ws_write on public.setlist_songs;
create policy ws_write on public.setlist_songs for all to authenticated
  using (exists (select 1 from public.setlists p where p.id = setlist_id
          and public.is_workspace_member(p.workspace_id) and public.workspace_access(p.workspace_id) = 'full'))
  with check (exists (select 1 from public.setlists p where p.id = setlist_id
          and public.is_workspace_member(p.workspace_id) and public.workspace_access(p.workspace_id) = 'full'));

-- note_checklist_items -> notes
drop policy if exists ws_select on public.note_checklist_items;
create policy ws_select on public.note_checklist_items for select to authenticated using (
  exists (select 1 from public.notes p where p.id = note_id
          and public.is_workspace_member(p.workspace_id) and public.workspace_access(p.workspace_id) <> 'none'));
drop policy if exists ws_write on public.note_checklist_items;
create policy ws_write on public.note_checklist_items for all to authenticated
  using (exists (select 1 from public.notes p where p.id = note_id
          and public.is_workspace_member(p.workspace_id) and public.workspace_access(p.workspace_id) = 'full'))
  with check (exists (select 1 from public.notes p where p.id = note_id
          and public.is_workspace_member(p.workspace_id) and public.workspace_access(p.workspace_id) = 'full'));

-- budget_adjustments -> budgets
drop policy if exists ws_select on public.budget_adjustments;
create policy ws_select on public.budget_adjustments for select to authenticated using (
  exists (select 1 from public.budgets p where p.id = budget_id
          and public.is_workspace_member(p.workspace_id) and public.workspace_access(p.workspace_id) <> 'none'));
drop policy if exists ws_write on public.budget_adjustments;
create policy ws_write on public.budget_adjustments for all to authenticated
  using (exists (select 1 from public.budgets p where p.id = budget_id
          and public.is_workspace_member(p.workspace_id) and public.workspace_access(p.workspace_id) = 'full'))
  with check (exists (select 1 from public.budgets p where p.id = budget_id
          and public.is_workspace_member(p.workspace_id) and public.workspace_access(p.workspace_id) = 'full'));

-- Sanity output: which policies now exist on each table.
select tablename, string_agg(policyname, ', ' order by policyname) as policies
from pg_policies where schemaname = 'public'
  and tablename in ('songs','setlists','setlist_songs','shows','event_management','notes','note_checklist_items',
                    'finance_transactions','pending_payments','budgets','budget_adjustments','split_runs',
                    'calendar_events','unavailability','recordings')
group by tablename order by tablename;
