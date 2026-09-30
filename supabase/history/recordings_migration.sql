-- Voice Recordings feature — run this once in the Supabase SQL editor.

-- Recordings table: standalone voice memos, optionally tagged to a song
-- (tag is editable anytime, not just at record time).
create table recordings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_path text not null,
  duration_seconds integer not null,
  mime_type text not null,
  song_id uuid references songs(id) on delete set null,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);
alter table recordings enable row level security;
create policy "authenticated full access" on recordings
  for all to authenticated using (true) with check (true);
create index recordings_created_at_idx on recordings(created_at desc);
create index recordings_song_id_idx on recordings(song_id) where song_id is not null;

-- Storage bucket for the actual audio files. Private (public = false) —
-- access only ever goes through a short-lived signed URL generated for an
-- authenticated user, same trust model as the DB table above, never a
-- public bucket a guessed URL could reach without logging in.
insert into storage.buckets (id, name, public)
values ('recordings', 'recordings', false)
on conflict (id) do nothing;

create policy "authenticated full access to recordings bucket"
  on storage.objects for all to authenticated
  using (bucket_id = 'recordings')
  with check (bucket_id = 'recordings');
