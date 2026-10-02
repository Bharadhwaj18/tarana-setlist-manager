-- Moves the notes that were really tasks into a board called "Tasks" (one per workspace).
-- A note counts as a task if it has an assignee, a due date, was completed, or has a
-- checklist item assigned to someone. Everything else stays a note.
-- Run AFTER 20261002000000_planner_tasks.sql. Safe to re-run (tasks.source_note_id is unique,
-- and moved notes are removed, so a second run finds nothing to do).
--
-- What carries over: title, description, assignee, due date, done state, reminder, repeat,
-- checklist (with ticks), labels, original created/updated times. Checklist-item assignees
-- become assignees of the task. Pin, colour and archive are note-only and are dropped.

begin;

create temp table _moving on commit drop as
select n.*
from public.notes n
where n.workspace_id is not null
  and not exists (select 1 from public.tasks t where t.source_note_id = n.id)
  and (
    n.assigned_to is not null
    or n.due_date is not null
    or n.completed_at is not null
    or exists (select 1 from public.note_checklist_items c where c.note_id = n.id and c.assigned_to is not null)
  );

-- One "Tasks" board (with To do / In progress / Done) in each workspace that has something to move.
insert into public.task_boards (workspace_id, name, created_by)
select w.id, 'Tasks', w.owner_id
from public.workspaces w
where w.id in (select workspace_id from _moving)
  and not exists (select 1 from public.task_boards b where b.workspace_id = w.id and b.name = 'Tasks');

-- The board each workspace's tasks land on (the oldest one called "Tasks").
create temp table _target on commit drop as
select distinct on (b.workspace_id) b.workspace_id, b.id as board_id
from public.task_boards b
where b.name = 'Tasks' and b.workspace_id in (select workspace_id from _moving)
order by b.workspace_id, b.created_at, b.id;

insert into public.task_buckets (board_id, name, position)
select g.board_id, x.name, x.position
from _target g
cross join (values ('To do', 1), ('In progress', 2), ('Done', 3)) as x(name, position)
where not exists (select 1 from public.task_buckets k where k.board_id = g.board_id);

-- Labels: each distinct note label becomes a (grey) label on that board, reusing one with the same name if present.
create temp table _lbl on commit drop as
select d.board_id, d.name,
  coalesce(
    (select (e ->> 'id')::uuid from public.task_boards b, jsonb_array_elements(b.labels) e
     where b.id = d.board_id and lower(e ->> 'name') = lower(d.name) limit 1),
    gen_random_uuid()
  ) as id,
  exists (
    select 1 from public.task_boards b, jsonb_array_elements(b.labels) e
    where b.id = d.board_id and lower(e ->> 'name') = lower(d.name)
  ) as existed
from (
  select distinct on (g.board_id, lower(left(btrim(l.label), 40))) g.board_id, left(btrim(l.label), 40) as name
  from _moving m
  join _target g on g.workspace_id = m.workspace_id
  cross join lateral unnest(coalesce(m.labels, '{}')) as l(label)
  where btrim(l.label) <> ''
) d;

update public.task_boards b
set labels = b.labels || (
  select jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name, 'color', 'gray'))
  from _lbl l where l.board_id = b.id and not l.existed
)
where exists (select 1 from _lbl l where l.board_id = b.id and not l.existed);

-- The tasks. Done notes land in the last bucket, the rest in the first.
insert into public.tasks (
  board_id, bucket_id, title, description, progress, priority, due_date, completed_at, position,
  remind_days_before, recurrence, assignee_ids, label_ids, checklist,
  source_note_id, created_by, updated_by, created_at, updated_at
)
select
  g.board_id,
  k.id,
  left(btrim(m.title), 300),
  m.content,
  case when m.completed_at is not null then 'completed' else 'not_started' end,
  'medium',
  m.due_date,
  m.completed_at,
  extract(epoch from m.created_at),
  m.remind_days_before,
  m.recurrence,
  -- the note's assignee plus anyone assigned to one of its checklist items (members only)
  coalesce((
    select array_agg(distinct a.user_id)
    from (
      select m.assigned_to as user_id
      union
      select c.assigned_to from public.note_checklist_items c where c.note_id = m.id
    ) a
    join public.workspace_members wm on wm.workspace_id = m.workspace_id and wm.user_id = a.user_id
  ), '{}'),
  coalesce((
    select array_agg(distinct l.id)
    from _lbl l
    cross join lateral unnest(coalesce(m.labels, '{}')) as x(label)
    where l.board_id = g.board_id and lower(l.name) = lower(left(btrim(x.label), 40))
  ), '{}'),
  coalesce((
    select jsonb_agg(
      jsonb_build_object('id', gen_random_uuid(), 'text', left(btrim(c.text), 300), 'done', c.done)
      order by c.position, c.id
    )
    from public.note_checklist_items c
    where c.note_id = m.id and btrim(c.text) <> ''
  ), '[]'::jsonb),
  m.id,
  m.created_by,
  m.updated_by,
  m.created_at,
  m.updated_at
from _moving m
join _target g on g.workspace_id = m.workspace_id
join lateral (
  select kb.id from public.task_buckets kb
  where kb.board_id = g.board_id
  order by case when m.completed_at is not null then -kb.position else kb.position end
  limit 1
) k on true
where btrim(m.title) <> ''
on conflict (source_note_id) do nothing;

-- Remove the notes that now live on the board (only ones that were actually copied).
delete from public.note_checklist_items
where note_id in (select source_note_id from public.tasks where source_note_id is not null);
delete from public.notes
where id in (select source_note_id from public.tasks where source_note_id is not null);

commit;
