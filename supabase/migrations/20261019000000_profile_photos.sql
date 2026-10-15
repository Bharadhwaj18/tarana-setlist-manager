-- Profile photos: a photo per person, shown wherever their name is.
-- Additive and safe to re-run. Nothing existing changes behaviour.
--
--   profiles.avatar_url
--   storage bucket "profile-avatars" (public read; each person can only write inside their own folder)

begin;

alter table public.profiles add column if not exists avatar_url text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_avatar_url_check') then
    alter table public.profiles
      add constraint profiles_avatar_url_check check (avatar_url is null or (char_length(avatar_url) <= 500 and avatar_url ~ '^https?://'));
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-avatars', 'profile-avatars', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

-- Objects live at {user_id}/{file}; only that person can add, replace or remove them.
drop policy if exists profile_avatar_insert on storage.objects;
create policy profile_avatar_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists profile_avatar_update on storage.objects;
create policy profile_avatar_update on storage.objects for update to authenticated
  using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists profile_avatar_delete on storage.objects;
create policy profile_avatar_delete on storage.objects for delete to authenticated
  using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

commit;
