-- Planner-style tasks: three tables.
--   task_boards   a board; its label palette lives on the board row (labels jsonb)
--   task_buckets  the ordered columns of a board (a task has exactly one, so a real FK)
--   tasks         a task; assignees, label ids and the checklist are columns on the task
-- Additive and safe to re-run. Nothing existing is touched; run the data-move file
-- (20261002000100_move_notes_to_tasks.sql) afterwards.
--
-- Access: everyone in the workspace sees every board and can edit every task. The same
-- ws_select / ws_insert / ws_update / ws_delete policies as every other table.

begin;

-- Tables ------------------------------------------------------------------------------

create table if not exists public.task_boards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  -- [{ "id": uuid, "name": text, "color": text }]
  labels jsonb not null default '[]'::jsonb
    check (jsonb_typeof(labels) = 'array' and jsonb_array_length(labels) <= 50),
  archived_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists public.task_buckets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  board_id uuid not null references public.task_boards(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  position double precision not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  board_id uuid not null references public.task_boards(id) on delete cascade,
  bucket_id uuid not null references public.task_buckets(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 300),
  description text,
  progress text not null default 'not_started' check (progress in ('not_started', 'in_progress', 'completed')),
  priority text not null default 'medium' check (priority in ('urgent', 'important', 'medium', 'low')),
  start_date date,
  due_date date,
  completed_at timestamptz,
  position double precision not null default 0,
  remind_days_before integer check (remind_days_before is null or remind_days_before >= 0),
  recurrence text check (recurrence is null or recurrence in ('daily', 'weekly', 'monthly')),
  assignee_ids uuid[] not null default '{}' check (cardinality(assignee_ids) <= 50),
  label_ids uuid[] not null default '{}' check (cardinality(label_ids) <= 50),
  -- [{ "id": uuid, "text": text, "done": boolean }] in display order
  checklist jsonb not null default '[]'::jsonb
    check (jsonb_typeof(checklist) = 'array' and jsonb_array_length(checklist) <= 200),
  source_note_id uuid unique,
  created_by uuid not null,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists task_boards_ws_idx on public.task_boards (workspace_id);
create index if not exists task_buckets_board_idx on public.task_buckets (board_id, position);
create index if not exists tasks_board_bucket_idx on public.tasks (board_id, bucket_id, position);
create index if not exists tasks_ws_due_idx on public.tasks (workspace_id, due_date);
create index if not exists tasks_assignees_idx on public.tasks using gin (assignee_ids);

-- Triggers: workspace_id always comes from the parent row, never from the client --------
-- Runs with the caller's rights, so a parent you can't see simply isn't found and the
-- insert fails (workspace_id is NOT NULL). Triggers fire in name order, hence the numbers.

create or replace function public.task_set_workspace_from_parent()
returns trigger language plpgsql set search_path = public as $$
declare ws uuid;
begin
  execute format('select workspace_id from public.%I where id = $1', tg_argv[0])
    into ws using (to_jsonb(new) ->> tg_argv[1])::uuid;
  new.workspace_id := ws;
  return new;
end $$;

drop trigger if exists task_boards_default_workspace on public.task_boards;
create trigger task_boards_default_workspace before insert on public.task_boards
  for each row execute function public.set_default_workspace();

drop trigger if exists task_buckets_ws on public.task_buckets;
create trigger task_buckets_ws before insert or update of board_id on public.task_buckets
  for each row execute function public.task_set_workspace_from_parent('task_boards', 'board_id');

drop trigger if exists tasks_1_ws on public.tasks;
create trigger tasks_1_ws before insert or update of board_id on public.tasks
  for each row execute function public.task_set_workspace_from_parent('task_boards', 'board_id');

-- A task's bucket must be on the task's own board.
create or replace function public.task_check_bucket()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from public.task_buckets b where b.id = new.bucket_id and b.board_id = new.board_id) then
    raise exception 'bucket does not belong to this board';
  end if;
  return new;
end $$;

drop trigger if exists tasks_2_check_bucket on public.tasks;
create trigger tasks_2_check_bucket before insert or update of board_id, bucket_id on public.tasks
  for each row execute function public.task_check_bucket();

-- Only members of the workspace can be assigned. Security definer so it can see the member list.
create or replace function public.task_check_assignees()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from unnest(new.assignee_ids) as a(user_id)
    where not exists (select 1 from public.workspace_members m where m.workspace_id = new.workspace_id and m.user_id = a.user_id)
  ) then
    raise exception 'assignee is not a member of this workspace';
  end if;
  return new;
end $$;

drop trigger if exists tasks_3_check_assignees on public.tasks;
create trigger tasks_3_check_assignees before insert or update of assignee_ids, workspace_id on public.tasks
  for each row execute function public.task_check_assignees();

create or replace function public.task_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists tasks_4_touch on public.tasks;
create trigger tasks_4_touch before update on public.tasks
  for each row execute function public.task_touch_updated_at();

-- Row level security ------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['task_boards', 'task_buckets', 'tasks'] loop
    execute format('alter table public.%I enable row level security', t);

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

    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

commit;
