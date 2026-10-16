-- Workspace groups: owners and admins make their own groups (Vocals, Rhythm, Flute...), put members in them,
-- and each group sees either the song's chord chart or its own notes for that song.
-- Additive and safe to re-run.

begin;

create table if not exists public.workspace_groups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  color text not null default '#1F5A43' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  sees text not null default 'notes' check (sees in ('chart', 'notes')),
  position double precision not null default 0,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create unique index if not exists workspace_groups_name_idx on public.workspace_groups (workspace_id, lower(btrim(name)));

create table if not exists public.workspace_group_members (
  group_id uuid not null references public.workspace_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  primary key (group_id, user_id)
);
create index if not exists workspace_group_members_ws_idx on public.workspace_group_members (workspace_id);
create index if not exists workspace_group_members_user_idx on public.workspace_group_members (user_id);

create table if not exists public.song_group_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  group_id uuid not null references public.workspace_groups(id) on delete cascade,
  content text not null default '' check (char_length(content) <= 20000),
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  unique (song_id, group_id)
);
create index if not exists song_group_notes_ws_idx on public.song_group_notes (workspace_id);

-- Owner or admin of a workspace.
create or replace function public.is_workspace_admin(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid() and m.role in ('owner', 'admin')
  )
$$;
revoke all on function public.is_workspace_admin(uuid) from public, anon;
grant execute on function public.is_workspace_admin(uuid) to authenticated;

-- The signed-in user is in this group.
create or replace function public.in_workspace_group(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workspace_group_members gm where gm.group_id = g and gm.user_id = auth.uid())
$$;
revoke all on function public.in_workspace_group(uuid) from public, anon;
grant execute on function public.in_workspace_group(uuid) to authenticated;

-- Leaving a workspace takes you out of its groups.
create or replace function public.drop_group_memberships() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.workspace_group_members where workspace_id = old.workspace_id and user_id = old.user_id;
  return old;
end
$$;
drop trigger if exists workspace_members_drop_groups on public.workspace_members;
create trigger workspace_members_drop_groups after delete on public.workspace_members
  for each row execute function public.drop_group_memberships();

alter table public.workspace_groups enable row level security;
alter table public.workspace_group_members enable row level security;
alter table public.song_group_notes enable row level security;

-- Groups: everyone in the workspace sees them; only owners and admins change them.
drop policy if exists ws_select on public.workspace_groups;
create policy ws_select on public.workspace_groups for select to authenticated
  using (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) <> 'none');
drop policy if exists ws_admin_write on public.workspace_groups;
create policy ws_admin_write on public.workspace_groups for all to authenticated
  using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));

-- Who's in which group: same, and a row must match its group's workspace and a real member of it.
drop policy if exists ws_select on public.workspace_group_members;
create policy ws_select on public.workspace_group_members for select to authenticated
  using (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) <> 'none');
drop policy if exists ws_admin_write on public.workspace_group_members;
create policy ws_admin_write on public.workspace_group_members for all to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (
    public.is_workspace_admin(workspace_id)
    and exists (select 1 from public.workspace_groups g where g.id = group_id and g.workspace_id = workspace_group_members.workspace_id)
    and exists (select 1 from public.workspace_members m where m.workspace_id = workspace_group_members.workspace_id and m.user_id = workspace_group_members.user_id)
  );

-- A group's notes on a song: readable by anyone who can open Songs; written by the group's own members
-- or anyone who can edit songs.
drop policy if exists ws_select on public.song_group_notes;
create policy ws_select on public.song_group_notes for select to authenticated
  using (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) <> 'none'
    and public.section_level(workspace_id, 'songs') <> 'none');
drop policy if exists ws_write on public.song_group_notes;
create policy ws_write on public.song_group_notes for all to authenticated
  using (public.is_workspace_member(workspace_id)
    and (public.section_level(workspace_id, 'songs') = 'edit' or public.in_workspace_group(group_id)))
  with check (
    public.is_workspace_member(workspace_id)
    and public.section_level(workspace_id, 'songs') <> 'none'
    and (public.section_level(workspace_id, 'songs') = 'edit' or public.in_workspace_group(group_id))
    and exists (select 1 from public.workspace_groups g where g.id = group_id and g.workspace_id = song_group_notes.workspace_id)
    and exists (select 1 from public.songs s where s.id = song_id and s.workspace_id = song_group_notes.workspace_id)
  );

revoke all on public.workspace_groups from anon;
revoke all on public.workspace_group_members from anon;
revoke all on public.song_group_notes from anon;

commit;
