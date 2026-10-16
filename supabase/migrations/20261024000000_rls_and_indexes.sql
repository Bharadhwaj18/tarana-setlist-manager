-- RLS and index tune-up. Safe to re-run. Needs 20261023000000_data_integrity (setlist_songs.workspace_id).
--
--   1. setlist_songs and note_checklist_items: the restrictive "section write" policy was FOR ALL, which
--      includes SELECT — so a member with view-only access to Setlists/Notes saw setlists with no songs
--      and notes with no checklist. Split into insert/update/delete. setlist_songs now checks its own
--      workspace_id instead of joining to setlists for every row.
--   2. budget_adjustments: same split, plus the finance section check it never had.
--   3. auth.uid() wrapped as (select auth.uid()) in the policies the advisor flagged, so it is evaluated
--      once per query instead of once per row.
--   4. Indexes for the foreign keys that are actually joined or cascaded on.
--   5. notifications: an index for the unread badge, and dedupe_key so the daily reminder job can be
--      re-run without sending the same reminder twice.

begin;

do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'setlist_songs' and column_name = 'workspace_id') then
    raise exception 'Run 20261023000000_data_integrity.sql first — setlist_songs.workspace_id is missing';
  end if;
end $$;

-- 1a. setlist_songs ---------------------------------------------------------------------------

do $$
declare p text;
begin
  foreach p in array array['ws_select', 'ws_write', 'ws_insert', 'ws_update', 'ws_delete',
                           'ws_section_read', 'ws_section_write', 'ws_section_insert', 'ws_section_update', 'ws_section_delete'] loop
    execute format('drop policy if exists %I on public.setlist_songs', p);
  end loop;
end $$;

create policy ws_select on public.setlist_songs for select to authenticated
  using (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) <> 'none');
create policy ws_insert on public.setlist_songs for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = 'full');
create policy ws_update on public.setlist_songs for update to authenticated
  using (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = 'full')
  with check (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = 'full');
create policy ws_delete on public.setlist_songs for delete to authenticated
  using (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = 'full');

create policy ws_section_read on public.setlist_songs as restrictive for select to authenticated
  using (public.section_level(workspace_id, 'setlists') <> 'none');
create policy ws_section_insert on public.setlist_songs as restrictive for insert to authenticated
  with check (public.section_level(workspace_id, 'setlists') = 'edit');
create policy ws_section_update on public.setlist_songs as restrictive for update to authenticated
  using (public.section_level(workspace_id, 'setlists') = 'edit')
  with check (public.section_level(workspace_id, 'setlists') = 'edit');
create policy ws_section_delete on public.setlist_songs as restrictive for delete to authenticated
  using (public.section_level(workspace_id, 'setlists') = 'edit');

-- 1b/2. Children that still reach their workspace through the parent -------------------------------
-- (table, parent table, parent key column, section)

do $$
declare
  r record;
  member_full text;
  member_read text;
  sec_edit text;
  sec_read text;
  p text;
begin
  for r in select * from (values
    ('note_checklist_items', 'notes',   'note_id',   'notes'),
    ('budget_adjustments',   'budgets', 'budget_id', 'finance')
  ) as v(tbl, parent, fk, sec) loop
    member_full := format('exists (select 1 from public.%I p where p.id = %I.%I and public.is_workspace_member(p.workspace_id) and public.workspace_access(p.workspace_id) = ''full'')', r.parent, r.tbl, r.fk);
    member_read := format('exists (select 1 from public.%I p where p.id = %I.%I and public.is_workspace_member(p.workspace_id) and public.workspace_access(p.workspace_id) <> ''none'')', r.parent, r.tbl, r.fk);
    sec_edit := format('exists (select 1 from public.%I p where p.id = %I.%I and public.section_level(p.workspace_id, %L) = ''edit'')', r.parent, r.tbl, r.fk, r.sec);
    sec_read := format('exists (select 1 from public.%I p where p.id = %I.%I and public.section_level(p.workspace_id, %L) <> ''none'')', r.parent, r.tbl, r.fk, r.sec);

    foreach p in array array['ws_select', 'ws_write', 'ws_insert', 'ws_update', 'ws_delete',
                             'ws_section_read', 'ws_section_write', 'ws_section_insert', 'ws_section_update', 'ws_section_delete'] loop
      execute format('drop policy if exists %I on public.%I', p, r.tbl);
    end loop;

    execute format('create policy ws_select on public.%I for select to authenticated using (%s)', r.tbl, member_read);
    execute format('create policy ws_insert on public.%I for insert to authenticated with check (%s)', r.tbl, member_full);
    execute format('create policy ws_update on public.%I for update to authenticated using (%s) with check (%s)', r.tbl, member_full, member_full);
    execute format('create policy ws_delete on public.%I for delete to authenticated using (%s)', r.tbl, member_full);

    execute format('create policy ws_section_read on public.%I as restrictive for select to authenticated using (%s)', r.tbl, sec_read);
    execute format('create policy ws_section_insert on public.%I as restrictive for insert to authenticated with check (%s)', r.tbl, sec_edit);
    execute format('create policy ws_section_update on public.%I as restrictive for update to authenticated using (%s) with check (%s)', r.tbl, sec_edit, sec_edit);
    execute format('create policy ws_section_delete on public.%I as restrictive for delete to authenticated using (%s)', r.tbl, sec_edit);
  end loop;
end $$;

-- 3. auth.uid() once per query --------------------------------------------------------------------

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

drop policy if exists ps_select on public.profiles;
create policy ps_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_workspace_with(id));

drop policy if exists invites_insert on public.workspace_invites;
create policy invites_insert on public.workspace_invites for insert to authenticated
  with check (
    public.is_workspace_admin(workspace_id) and public.workspace_access(workspace_id) = 'full'
    and created_by = (select auth.uid()) and use_count = 0 and revoked_at is null
    and expires_at <= now() + interval '31 days'
    and (select w.type from public.workspaces w where w.id = workspace_invites.workspace_id) <> 'personal'
  );

drop policy if exists members_delete on public.workspace_members;
create policy members_delete on public.workspace_members for delete to authenticated
  using (
    role <> 'owner'
    and (public.is_workspace_admin(workspace_id) or user_id = (select auth.uid()))
    and (select w.type from public.workspaces w where w.id = workspace_members.workspace_id) <> 'personal'
  );

drop policy if exists ws_select on public.notes;
create policy ws_select on public.notes for select to authenticated
  using (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) <> 'none'
    and (visibility = 'shared' or created_by = (select auth.uid())));
drop policy if exists ws_update on public.notes;
create policy ws_update on public.notes for update to authenticated
  using (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = 'full'
    and (visibility = 'shared' or created_by = (select auth.uid())))
  with check (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = 'full'
    and (visibility = 'shared' or created_by = (select auth.uid())));
drop policy if exists ws_delete on public.notes;
create policy ws_delete on public.notes for delete to authenticated
  using (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = 'full'
    and (visibility = 'shared' or created_by = (select auth.uid())));

drop policy if exists fr_select on public.finance_requests;
create policy fr_select on public.finance_requests for select to authenticated
  using (public.is_workspace_member(workspace_id) and (submitted_by = (select auth.uid()) or public.finance_approver(workspace_id)));
drop policy if exists fr_insert on public.finance_requests;
create policy fr_insert on public.finance_requests for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = 'full'
    and public.section_level(workspace_id, 'finance') = 'edit' and submitted_by = (select auth.uid()));
drop policy if exists fr_update on public.finance_requests;
create policy fr_update on public.finance_requests for update to authenticated
  using (public.is_workspace_member(workspace_id) and submitted_by = (select auth.uid()))
  with check (public.is_workspace_member(workspace_id) and submitted_by = (select auth.uid()));
drop policy if exists fr_delete on public.finance_requests;
create policy fr_delete on public.finance_requests for delete to authenticated
  using (public.is_workspace_member(workspace_id) and (submitted_by = (select auth.uid()) or public.finance_approver(workspace_id)));

-- 4. Foreign-key indexes that get used --------------------------------------------------------------

create index if not exists setlist_songs_ws_idx         on public.setlist_songs (workspace_id);
create index if not exists setlist_songs_song_idx       on public.setlist_songs (song_id);
create index if not exists finance_transactions_show_idx on public.finance_transactions (show_id) where show_id is not null;
create index if not exists pending_payments_show_idx    on public.pending_payments (show_id) where show_id is not null;
create index if not exists finance_requests_show_idx    on public.finance_requests (show_id) where show_id is not null;
create index if not exists shows_event_management_idx   on public.shows (event_management_id) where event_management_id is not null;
create index if not exists tasks_bucket_idx             on public.tasks (bucket_id);
create index if not exists budget_adjustments_budget_idx on public.budget_adjustments (budget_id);
create index if not exists unavailability_member_idx    on public.unavailability (member_id);
create index if not exists task_buckets_ws_idx          on public.task_buckets (workspace_id);
create index if not exists show_documents_ws_idx        on public.show_documents (workspace_id);

-- 5. Notifications ----------------------------------------------------------------------------------

create index if not exists notifications_unread_idx on public.notifications (recipient_id) where read_at is null;

-- e.g. 'task_due:<task id>:<date>:<recipient id>'. Null for ordinary notifications; nulls never clash.
alter table public.notifications add column if not exists dedupe_key text;
create unique index if not exists notifications_dedupe_key on public.notifications (dedupe_key);

-- Only the reminder job (service role) sets dedupe_key; a signed-in user could otherwise pre-claim a
-- reminder's key and suppress it.
revoke insert on public.notifications from authenticated;
grant insert (recipient_id, sender_id, workspace_id, title, body, link, type) on public.notifications to authenticated;

commit;
