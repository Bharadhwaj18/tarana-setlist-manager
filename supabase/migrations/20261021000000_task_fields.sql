-- Custom task columns: a workspace adds its own columns (tick box, dropdown, text, number, date,
-- person) to the Tasks list. Values live on each task in tasks.custom, keyed by the column's id.
-- Additive and safe to re-run.

begin;

create table if not exists public.task_fields (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  type text not null check (type in ('checkbox', 'select', 'text', 'number', 'date', 'person')),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  position double precision not null default 0,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists task_fields_ws_idx on public.task_fields (workspace_id);

alter table public.tasks add column if not exists custom jsonb not null default '{}'::jsonb;

alter table public.task_fields enable row level security;

drop policy if exists ws_select on public.task_fields;
create policy ws_select on public.task_fields for select to authenticated
  using (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) <> 'none');
drop policy if exists ws_insert on public.task_fields;
create policy ws_insert on public.task_fields for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = 'full');
drop policy if exists ws_update on public.task_fields;
create policy ws_update on public.task_fields for update to authenticated
  using (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = 'full')
  with check (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = 'full');
drop policy if exists ws_delete on public.task_fields;
create policy ws_delete on public.task_fields for delete to authenticated
  using (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = 'full');

drop policy if exists ws_section_read on public.task_fields;
create policy ws_section_read on public.task_fields as restrictive for select to authenticated
  using (public.section_level(workspace_id, 'tasks') <> 'none');
drop policy if exists ws_section_insert on public.task_fields;
create policy ws_section_insert on public.task_fields as restrictive for insert to authenticated
  with check (public.section_level(workspace_id, 'tasks') = 'edit');
drop policy if exists ws_section_update on public.task_fields;
create policy ws_section_update on public.task_fields as restrictive for update to authenticated
  using (public.section_level(workspace_id, 'tasks') = 'edit') with check (public.section_level(workspace_id, 'tasks') = 'edit');
drop policy if exists ws_section_delete on public.task_fields;
create policy ws_section_delete on public.task_fields as restrictive for delete to authenticated
  using (public.section_level(workspace_id, 'tasks') = 'edit');

revoke all on public.task_fields from anon;

-- Grants: Supabase no longer opens new tables to the API on its own (from 2026-10-30), so say who may reach them.
-- Row-level security above still decides which rows; logged-out visitors get nothing.
grant select, insert, update, delete on public.task_fields to authenticated;
grant select, insert, update, delete on public.task_fields to service_role;

commit;
