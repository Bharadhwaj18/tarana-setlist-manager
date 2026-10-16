-- Song references: links to Spotify, YouTube, Apple Music or SoundCloud on a song, each with a label
-- ("Original", "The version we copy", ...) and optional jump-to moments. Songs also get a cover image.
-- Additive and safe to re-run.

begin;

alter table public.songs add column if not exists cover_url text;

create table if not exists public.song_references (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  source text not null check (source in ('spotify', 'youtube', 'apple', 'soundcloud')),
  url text not null check (char_length(url) <= 600),
  external_id text,
  label text not null default 'Original' check (char_length(btrim(label)) between 1 and 40),
  title text,
  artist text,
  thumbnail_url text,
  duration_ms integer,
  -- [{ "label": "Solo", "at": 161 }], at = seconds from the start
  moments jsonb not null default '[]'::jsonb check (jsonb_typeof(moments) = 'array'),
  position double precision not null default 0,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists song_references_song_idx on public.song_references (song_id, position);
create index if not exists song_references_ws_idx on public.song_references (workspace_id);

alter table public.song_references enable row level security;

drop policy if exists ws_select on public.song_references;
create policy ws_select on public.song_references for select to authenticated
  using (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) <> 'none');
drop policy if exists ws_insert on public.song_references;
create policy ws_insert on public.song_references for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = 'full');
drop policy if exists ws_update on public.song_references;
create policy ws_update on public.song_references for update to authenticated
  using (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = 'full')
  with check (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = 'full');
drop policy if exists ws_delete on public.song_references;
create policy ws_delete on public.song_references for delete to authenticated
  using (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = 'full');

drop policy if exists ws_section_read on public.song_references;
create policy ws_section_read on public.song_references as restrictive for select to authenticated
  using (public.section_level(workspace_id, 'songs') <> 'none');
drop policy if exists ws_section_insert on public.song_references;
create policy ws_section_insert on public.song_references as restrictive for insert to authenticated
  with check (public.section_level(workspace_id, 'songs') = 'edit');
drop policy if exists ws_section_update on public.song_references;
create policy ws_section_update on public.song_references as restrictive for update to authenticated
  using (public.section_level(workspace_id, 'songs') = 'edit') with check (public.section_level(workspace_id, 'songs') = 'edit');
drop policy if exists ws_section_delete on public.song_references;
create policy ws_section_delete on public.song_references as restrictive for delete to authenticated
  using (public.section_level(workspace_id, 'songs') = 'edit');

revoke all on public.song_references from anon;

commit;
