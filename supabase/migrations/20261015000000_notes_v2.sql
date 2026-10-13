-- Notes v2: private by default (can be shared with the workspace), link a note to a show or song,
-- and a soft-delete Trash. Additive and safe to re-run. Existing notes stay visible to the whole
-- workspace (they become 'shared'); only notes created from now on default to 'private'.

begin;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notes' and column_name = 'visibility'
  ) then
    alter table public.notes add column visibility text not null default 'shared';
    alter table public.notes alter column visibility set default 'private';
  end if;
end $$;

alter table public.notes drop constraint if exists notes_visibility_check;
alter table public.notes add constraint notes_visibility_check check (visibility in ('private', 'shared'));

alter table public.notes add column if not exists show_id uuid references public.shows(id) on delete set null;
alter table public.notes add column if not exists song_id uuid references public.songs(id) on delete set null;
alter table public.notes add column if not exists deleted_at timestamptz;

create index if not exists notes_show_idx on public.notes (show_id) where show_id is not null;
create index if not exists notes_song_idx on public.notes (song_id) where song_id is not null;
create index if not exists notes_ws_deleted_idx on public.notes (workspace_id, deleted_at);

-- Private notes are visible (and editable) only to their author; shared notes to every member.
-- Checklist items follow their note: their policies look the parent note up, so they inherit this.
drop policy if exists ws_select on public.notes;
create policy ws_select on public.notes for select to authenticated
  using (
    public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) <> 'none'
    and (visibility = 'shared' or created_by = auth.uid())
  );

drop policy if exists ws_update on public.notes;
create policy ws_update on public.notes for update to authenticated
  using (
    public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = 'full'
    and (visibility = 'shared' or created_by = auth.uid())
  )
  with check (
    public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = 'full'
    and (visibility = 'shared' or created_by = auth.uid())
  );

drop policy if exists ws_delete on public.notes;
create policy ws_delete on public.notes for delete to authenticated
  using (
    public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = 'full'
    and (visibility = 'shared' or created_by = auth.uid())
  );

-- Only the author can switch a note between private and shared.
create or replace function public.notes_guard_visibility()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.visibility is distinct from old.visibility and auth.uid() is not null and auth.uid() <> old.created_by then
    raise exception 'only the author can change who can see this note';
  end if;
  return new;
end $$;

drop trigger if exists notes_guard_visibility on public.notes;
create trigger notes_guard_visibility before update of visibility on public.notes
  for each row execute function public.notes_guard_visibility();

commit;
