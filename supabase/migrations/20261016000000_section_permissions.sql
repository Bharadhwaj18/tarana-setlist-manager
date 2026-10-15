-- Per-section access for each workspace member: 'edit', 'view' or 'none'.
-- Stored as workspace_members.permissions -> 'sections' -> '<section>'. A missing key means 'edit',
-- so existing members keep everything until an admin changes it. Owners and admins always get 'edit'.
-- Enforced with RESTRICTIVE policies, which only ever narrow what the existing policies allow.
-- Additive and safe to re-run.

begin;

create or replace function public.section_level(ws uuid, sec text)
returns text language sql stable security definer set search_path = public as $$
  select case
    when m.role in ('owner', 'admin') then 'edit'
    else coalesce(m.permissions -> 'sections' ->> sec, 'edit')
  end
  from public.workspace_members m
  where m.workspace_id = ws and m.user_id = auth.uid()
  limit 1
$$;

revoke all on function public.section_level(uuid, text) from public, anon;
grant execute on function public.section_level(uuid, text) to authenticated;

-- Tables that carry their own workspace_id.
do $$
declare
  pair record;
begin
  for pair in
    select * from (values
      ('songs', 'songs'),
      ('setlists', 'setlists'),
      ('shows', 'shows'),
      ('show_documents', 'shows'),
      ('event_management', 'agencies'),
      ('notes', 'notes'),
      ('finance_transactions', 'finance'),
      ('pending_payments', 'finance'),
      ('budgets', 'finance'),
      ('split_runs', 'finance'),
      ('calendar_events', 'calendar'),
      ('unavailability', 'calendar'),
      ('recordings', 'recordings'),
      ('task_boards', 'tasks'),
      ('task_buckets', 'tasks'),
      ('tasks', 'tasks')
    ) as v(tbl, sec)
  loop
    if to_regclass('public.' || pair.tbl) is null then continue; end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = pair.tbl and column_name = 'workspace_id'
    ) then
      raise notice 'skipped %: no workspace_id column', pair.tbl;
      continue;
    end if;

    execute format('drop policy if exists ws_section_read on public.%I', pair.tbl);
    execute format($p$create policy ws_section_read on public.%I as restrictive for select to authenticated
      using (public.section_level(workspace_id, %L) <> 'none')$p$, pair.tbl, pair.sec);

    execute format('drop policy if exists ws_section_insert on public.%I', pair.tbl);
    execute format($p$create policy ws_section_insert on public.%I as restrictive for insert to authenticated
      with check (public.section_level(workspace_id, %L) = 'edit')$p$, pair.tbl, pair.sec);

    execute format('drop policy if exists ws_section_update on public.%I', pair.tbl);
    execute format($p$create policy ws_section_update on public.%I as restrictive for update to authenticated
      using (public.section_level(workspace_id, %L) = 'edit')
      with check (public.section_level(workspace_id, %L) = 'edit')$p$, pair.tbl, pair.sec, pair.sec);

    execute format('drop policy if exists ws_section_delete on public.%I', pair.tbl);
    execute format($p$create policy ws_section_delete on public.%I as restrictive for delete to authenticated
      using (public.section_level(workspace_id, %L) = 'edit')$p$, pair.tbl, pair.sec);
  end loop;
end $$;

-- Child rows with no workspace_id of their own: check through their parent row.
do $$
begin
  if to_regclass('public.setlist_songs') is not null then
    drop policy if exists ws_section_read on public.setlist_songs;
    create policy ws_section_read on public.setlist_songs as restrictive for select to authenticated
      using (exists (select 1 from public.setlists p where p.id = setlist_id and public.section_level(p.workspace_id, 'setlists') <> 'none'));
    drop policy if exists ws_section_write on public.setlist_songs;
    create policy ws_section_write on public.setlist_songs as restrictive for all to authenticated
      using (exists (select 1 from public.setlists p where p.id = setlist_id and public.section_level(p.workspace_id, 'setlists') = 'edit'))
      with check (exists (select 1 from public.setlists p where p.id = setlist_id and public.section_level(p.workspace_id, 'setlists') = 'edit'));
  end if;

  if to_regclass('public.note_checklist_items') is not null then
    drop policy if exists ws_section_read on public.note_checklist_items;
    create policy ws_section_read on public.note_checklist_items as restrictive for select to authenticated
      using (exists (select 1 from public.notes p where p.id = note_id and public.section_level(p.workspace_id, 'notes') <> 'none'));
    drop policy if exists ws_section_write on public.note_checklist_items;
    create policy ws_section_write on public.note_checklist_items as restrictive for all to authenticated
      using (exists (select 1 from public.notes p where p.id = note_id and public.section_level(p.workspace_id, 'notes') = 'edit'))
      with check (exists (select 1 from public.notes p where p.id = note_id and public.section_level(p.workspace_id, 'notes') = 'edit'));
  end if;
end $$;

commit;
