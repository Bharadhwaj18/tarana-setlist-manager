-- Data integrity. The database now enforces what the app only assumed. Safe to re-run.
-- Checked against live data on 2026-10-16: nothing below rejects an existing row.
--
--   1. Links stay inside one workspace. A finance entry, note, setlist, recording or document can only
--      point at a show/song/project/budget/agency in its own workspace (composite foreign keys).
--      setlist_songs gains workspace_id (filled from its setlist) so a setlist can't hold another
--      workspace's song — and so its rows can be queried by workspace.
--   2. Deleting a user no longer fails on songs/setlists they created (created_by was NOT NULL but
--      ON DELETE SET NULL).
--   3. Fixed value lists: member role, workspace type/status, one owner per workspace, length limits on
--      finance category and booking status.
--   4. Money columns are all numeric(12,2). finance_transactions was numeric(10,2) while requests and
--      budgets were unlimited, so a large approved request could fail to post.
--   5. finance_audit: every insert/update/delete on finance_transactions and pending_payments is
--      recorded with who did it. Admins and treasurers can read it; nobody can edit it.
--   6. The workspace-defaulting triggers are gone. A row written without workspace_id now fails instead
--      of silently landing in the writer's default workspace. Every insert in the app passes it.
--   7. One setlist per show (20261015000200 was never applied).
--   8. profiles.role ('member'/'treasurer') is dropped. Treasurer lives in workspace_members.permissions;
--      nothing reads the old column.
--
-- Works with the app as deployed now; apply before the code that reads setlist_songs.workspace_id.

begin;

-- 1. Same-workspace links ------------------------------------------------------------------

-- Composite keys for the parents (id is already unique; this lets children reference (id, workspace_id)).
do $$
declare t text;
begin
  foreach t in array array['shows', 'songs', 'setlists', 'finance_projects', 'budgets', 'event_management'] loop
    if not exists (select 1 from pg_constraint where conname = t || '_id_ws_key') then
      execute format('alter table public.%I add constraint %I unique (id, workspace_id)', t, t || '_id_ws_key');
    end if;
  end loop;
end $$;

-- setlist_songs.workspace_id, kept in step with its setlist by the same trigger tasks use.
alter table public.setlist_songs add column if not exists workspace_id uuid;
update public.setlist_songs ss set workspace_id = s.workspace_id
  from public.setlists s where s.id = ss.setlist_id and ss.workspace_id is distinct from s.workspace_id;
alter table public.setlist_songs alter column workspace_id set not null;

drop trigger if exists setlist_songs_ws on public.setlist_songs;
create trigger setlist_songs_ws before insert or update of setlist_id on public.setlist_songs
  for each row execute function public.task_set_workspace_from_parent('setlists', 'setlist_id');

-- (table, constraint, columns, parent, on delete)
do $$
declare
  r record;
begin
  for r in select * from (values
    ('setlist_songs',        'setlist_songs_setlist_id_fkey',        'setlist_id',          'setlists',         'cascade'),
    ('setlist_songs',        'setlist_songs_song_id_fkey',           'song_id',             'songs',            'cascade'),
    ('finance_transactions', 'finance_transactions_show_id_fkey',    'show_id',             'shows',            'set null (show_id)'),
    ('finance_transactions', 'finance_transactions_project_id_fkey', 'project_id',          'finance_projects', 'set null (project_id)'),
    ('finance_transactions', 'finance_transactions_budget_id_fkey',  'budget_id',           'budgets',          'set null (budget_id)'),
    ('finance_requests',     'finance_requests_show_id_fkey',        'show_id',             'shows',            'cascade'),
    ('finance_requests',     'finance_requests_project_id_fkey',     'project_id',          'finance_projects', 'set null (project_id)'),
    ('finance_requests',     'finance_requests_budget_id_fkey',      'budget_id',           'budgets',          'set null (budget_id)'),
    ('pending_payments',     'pending_payments_show_id_fkey',        'show_id',             'shows',            'set null (show_id)'),
    ('setlists',             'setlists_show_id_fkey',                'show_id',             'shows',            'set null (show_id)'),
    ('shows',                'shows_event_management_id_fkey',       'event_management_id', 'event_management', 'set null (event_management_id)'),
    ('notes',                'notes_show_id_fkey',                   'show_id',             'shows',            'set null (show_id)'),
    ('notes',                'notes_song_id_fkey',                   'song_id',             'songs',            'set null (song_id)'),
    ('recordings',           'recordings_song_id_fkey',              'song_id',             'songs',            'set null (song_id)'),
    ('show_documents',       'show_documents_show_id_fkey',          'show_id',             'shows',            'cascade')
  ) as v(tbl, old_name, col, parent, on_delete) loop
    execute format('alter table public.%I drop constraint if exists %I', r.tbl, r.old_name);
    execute format('alter table public.%I drop constraint if exists %I', r.tbl, r.tbl || '_' || r.col || '_ws_fkey');
    execute format(
      'alter table public.%I add constraint %I foreign key (%I, workspace_id) references public.%I (id, workspace_id) on delete %s',
      r.tbl, r.tbl || '_' || r.col || '_ws_fkey', r.col, r.parent, r.on_delete);
  end loop;
end $$;

-- 2. Authors can be deleted ------------------------------------------------------------------

alter table public.songs alter column created_by drop not null;
alter table public.setlists alter column created_by drop not null;

-- 3. Fixed value lists ------------------------------------------------------------------------

alter table public.workspace_members drop constraint if exists workspace_members_role_check;
alter table public.workspace_members add constraint workspace_members_role_check
  check (role in ('owner', 'admin', 'member'));

-- Ownership transfer demotes the old owner before promoting the new one, so this never trips mid-transfer.
create unique index if not exists workspace_members_one_owner on public.workspace_members (workspace_id) where role = 'owner';

alter table public.workspaces drop constraint if exists workspaces_type_check;
alter table public.workspaces add constraint workspaces_type_check check (type in ('band', 'personal'));
alter table public.workspaces drop constraint if exists workspaces_status_check;
alter table public.workspaces add constraint workspaces_status_check check (status in ('active', 'read_only', 'blocked'));
alter table public.workspaces drop constraint if exists workspaces_plan_check;
alter table public.workspaces add constraint workspaces_plan_check check (char_length(plan) between 1 and 30);

-- Categories are configurable per workspace (Money settings), so only the length is fixed.
alter table public.finance_transactions drop constraint if exists finance_transactions_category_check;
alter table public.finance_transactions add constraint finance_transactions_category_check
  check (category is null or char_length(category) between 1 and 40);
alter table public.finance_requests drop constraint if exists finance_requests_category_check;
alter table public.finance_requests add constraint finance_requests_category_check
  check (category is null or char_length(category) between 1 and 40);
alter table public.shows drop constraint if exists shows_booking_status_check;
alter table public.shows add constraint shows_booking_status_check
  check (booking_status is null or char_length(booking_status) <= 40);

alter table public.shows alter column created_at set not null;
alter table public.finance_transactions alter column created_at set not null;

-- 4. Money ------------------------------------------------------------------------------------

alter table public.finance_transactions alter column amount type numeric(12,2);
alter table public.finance_requests     alter column amount type numeric(12,2);
alter table public.finance_recurring    alter column amount type numeric(12,2);
alter table public.pending_payments     alter column amount type numeric(12,2);
alter table public.finance_projects     alter column budget type numeric(12,2);
alter table public.budgets              alter column allocated_amount type numeric(12,2);
alter table public.budget_adjustments   alter column delta type numeric(12,2);
alter table public.split_runs           alter column total_net type numeric(12,2);
alter table public.split_runs           alter column total_band_fund type numeric(12,2);

alter table public.pending_payments drop constraint if exists pending_payments_amount_check;
alter table public.pending_payments add constraint pending_payments_amount_check check (amount > 0);

-- 5. Finance audit log --------------------------------------------------------------------------

-- No foreign key to workspaces: deleting a workspace cascades deletes into finance_transactions,
-- and those audit rows must still be writable while the workspace row is going away.
create table if not exists public.finance_audit (
  id bigint generated always as identity primary key,
  workspace_id uuid not null,
  table_name text not null,
  row_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  old_row jsonb,
  new_row jsonb,
  actor uuid default auth.uid(),
  at timestamptz not null default now()
);
create index if not exists finance_audit_ws_at_idx on public.finance_audit (workspace_id, at desc);
create index if not exists finance_audit_row_idx on public.finance_audit (row_id);

alter table public.finance_audit enable row level security;
revoke all on public.finance_audit from anon;
revoke insert, update, delete on public.finance_audit from authenticated;

drop policy if exists fa_select on public.finance_audit;
create policy fa_select on public.finance_audit for select to authenticated
  using (public.finance_approver(workspace_id));

create or replace function public.finance_audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  r jsonb := coalesce(n, o);
begin
  insert into public.finance_audit (workspace_id, table_name, row_id, action, old_row, new_row)
  values ((r ->> 'workspace_id')::uuid, tg_table_name, (r ->> 'id')::uuid, lower(tg_op), o, n);
  return null;
end $$;
revoke all on function public.finance_audit_row() from public, anon, authenticated;

drop trigger if exists finance_transactions_audit on public.finance_transactions;
create trigger finance_transactions_audit after insert or update or delete on public.finance_transactions
  for each row execute function public.finance_audit_row();
drop trigger if exists pending_payments_audit on public.pending_payments;
create trigger pending_payments_audit after insert or update or delete on public.pending_payments
  for each row execute function public.finance_audit_row();

-- 6. No silent workspace defaulting --------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['songs', 'setlists', 'shows', 'event_management', 'notes', 'finance_transactions',
                           'pending_payments', 'budgets', 'split_runs', 'calendar_events', 'unavailability',
                           'recordings', 'task_boards'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_default_workspace', t);
  end loop;
end $$;
drop function if exists public.set_default_workspace();
drop function if exists public.default_workspace_id(uuid);

-- 7. One setlist per show -------------------------------------------------------------------------

create unique index if not exists setlists_one_per_show on public.setlists (show_id) where show_id is not null;

-- 8. Old treasurer flag ---------------------------------------------------------------------------

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles drop column if exists role;

-- Housekeeping flagged by the advisor.
alter function public.set_updated_at() set search_path = public;

commit;
