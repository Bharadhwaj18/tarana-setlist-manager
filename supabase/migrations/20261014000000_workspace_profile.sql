-- Workspace profile: colour, kind, description and a logo/photo, plus the functions the new
-- workspace screens need. Additive and safe to re-run; nothing existing changes behaviour.
--
--   workspaces.color / kind / description / avatar_url
--   storage bucket "workspace-avatars" (public read; only the workspace's owner/admins can write)
--   create_workspace(p_name, p_type, p_kind, p_color)   (old 2-argument calls keep working)
--   update_workspace_details(...)
--   transfer_workspace_ownership(p_ws, p_new_owner)
--   workspace_attention()  -- per-workspace member count, next show, tasks due, for badges and the overview

begin;

-- 1. Columns ------------------------------------------------------------------------

alter table public.workspaces add column if not exists color text not null default 'forest';
alter table public.workspaces add column if not exists kind text;
alter table public.workspaces add column if not exists description text;
alter table public.workspaces add column if not exists avatar_url text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'workspaces_color_check') then
    alter table public.workspaces
      add constraint workspaces_color_check check (color in ('forest', 'plum', 'ink', 'ocean', 'amber', 'rose'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'workspaces_kind_check') then
    alter table public.workspaces
      add constraint workspaces_kind_check check (kind is null or char_length(kind) <= 30);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'workspaces_description_check') then
    alter table public.workspaces
      add constraint workspaces_description_check check (description is null or char_length(description) <= 300);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'workspaces_avatar_url_check') then
    alter table public.workspaces
      add constraint workspaces_avatar_url_check check (avatar_url is null or (char_length(avatar_url) <= 500 and avatar_url ~ '^https?://'));
  end if;
end $$;

-- 2. Storage: public-read bucket, owner/admin write ---------------------------------
-- Objects live at {workspace_id}/{file}; the first folder decides who may write.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('workspace-avatars', 'workspace-avatars', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

drop policy if exists ws_avatar_insert on storage.objects;
create policy ws_avatar_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'workspace-avatars'
    and case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             then public.is_workspace_admin(((storage.foldername(name))[1])::uuid) else false end
  );

drop policy if exists ws_avatar_update on storage.objects;
create policy ws_avatar_update on storage.objects for update to authenticated
  using (
    bucket_id = 'workspace-avatars'
    and case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             then public.is_workspace_admin(((storage.foldername(name))[1])::uuid) else false end
  );

drop policy if exists ws_avatar_delete on storage.objects;
create policy ws_avatar_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'workspace-avatars'
    and case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             then public.is_workspace_admin(((storage.foldername(name))[1])::uuid) else false end
  );

-- 3. create_workspace gains an optional kind and colour -----------------------------
-- The old (text, text) signature is dropped first so the new defaults can't make calls ambiguous.

drop function if exists public.create_workspace(text, text);

create or replace function public.create_workspace(
  p_name text,
  p_type text default 'band',
  p_kind text default null,
  p_color text default 'forest'
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  clean text := btrim(coalesce(p_name, ''));
  clean_kind text := nullif(btrim(coalesce(p_kind, '')), '');
  ws uuid;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if char_length(clean) < 1 or char_length(clean) > 60 then raise exception 'Name must be 1-60 characters'; end if;
  if p_type <> 'band' then raise exception 'Unsupported workspace type'; end if;
  if clean_kind is not null and char_length(clean_kind) > 30 then raise exception 'Kind must be 30 characters or fewer'; end if;
  if p_color not in ('forest', 'plum', 'ink', 'ocean', 'amber', 'rose') then raise exception 'Unknown colour'; end if;
  if (select count(*) from public.workspaces w where w.owner_id = uid and w.type <> 'personal') >= 10 then
    raise exception 'You have reached the limit of 10 workspaces';
  end if;
  insert into public.workspaces (name, type, owner_id, kind, color)
  values (clean, p_type, uid, clean_kind, p_color)
  returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, uid, 'owner');
  return ws;
end $$;

revoke all on function public.create_workspace(text, text, text, text) from public, anon;
grant execute on function public.create_workspace(text, text, text, text) to authenticated;

-- 4. update_workspace_details --------------------------------------------------------
-- A null argument means "leave as is". Pass an empty string to clear kind or description,
-- and p_clear_avatar = true to remove the logo/photo.

create or replace function public.update_workspace_details(
  p_ws uuid,
  p_name text default null,
  p_kind text default null,
  p_description text default null,
  p_color text default null,
  p_avatar_url text default null,
  p_clear_avatar boolean default false
)
returns void language plpgsql security definer set search_path = public as $$
declare
  ws_type text;
  clean_name text := case when p_name is null then null else btrim(p_name) end;
  clean_kind text := case when p_kind is null then null else btrim(p_kind) end;
  clean_desc text := case when p_description is null then null else btrim(p_description) end;
begin
  if not public.is_workspace_admin(p_ws) then raise exception 'Only an admin can change this workspace'; end if;
  select type into ws_type from public.workspaces where id = p_ws;
  if ws_type is null then raise exception 'Workspace not found'; end if;

  if clean_name is not null then
    if ws_type = 'personal' then raise exception 'Personal spaces cannot be renamed'; end if;
    if char_length(clean_name) < 1 or char_length(clean_name) > 60 then raise exception 'Name must be 1-60 characters'; end if;
  end if;
  if clean_kind is not null and char_length(clean_kind) > 30 then raise exception 'Kind must be 30 characters or fewer'; end if;
  if clean_desc is not null and char_length(clean_desc) > 300 then raise exception 'Description must be 300 characters or fewer'; end if;
  if p_color is not null and p_color not in ('forest', 'plum', 'ink', 'ocean', 'amber', 'rose') then raise exception 'Unknown colour'; end if;
  if p_avatar_url is not null and (char_length(p_avatar_url) > 500 or p_avatar_url !~ '^https?://') then raise exception 'Invalid image address'; end if;

  update public.workspaces w set
    name = coalesce(clean_name, w.name),
    kind = case when clean_kind is null then w.kind else nullif(clean_kind, '') end,
    description = case when clean_desc is null then w.description else nullif(clean_desc, '') end,
    color = coalesce(p_color, w.color),
    avatar_url = case when p_clear_avatar then null else coalesce(p_avatar_url, w.avatar_url) end
  where w.id = p_ws;
end $$;

revoke all on function public.update_workspace_details(uuid, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.update_workspace_details(uuid, text, text, text, text, text, boolean) to authenticated;

-- 5. transfer_workspace_ownership ----------------------------------------------------

create or replace function public.transfer_workspace_ownership(p_ws uuid, p_new_owner uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  ws_type text;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select type into ws_type from public.workspaces where id = p_ws;
  if ws_type is null then raise exception 'Workspace not found'; end if;
  if ws_type = 'personal' then raise exception 'A personal space cannot be transferred'; end if;
  if not exists (select 1 from public.workspace_members m where m.workspace_id = p_ws and m.user_id = uid and m.role = 'owner') then
    raise exception 'Only the owner can transfer this workspace';
  end if;
  if p_new_owner = uid then raise exception 'You already own this workspace'; end if;
  if not exists (select 1 from public.workspace_members m where m.workspace_id = p_ws and m.user_id = p_new_owner) then
    raise exception 'The new owner must already be a member';
  end if;

  update public.workspace_members set role = 'admin' where workspace_id = p_ws and user_id = uid;
  update public.workspace_members set role = 'owner' where workspace_id = p_ws and user_id = p_new_owner;
  update public.workspaces set owner_id = p_new_owner where id = p_ws;
end $$;

revoke all on function public.transfer_workspace_ownership(uuid, uuid) from public, anon;
grant execute on function public.transfer_workspace_ownership(uuid, uuid) to authenticated;

-- 6. workspace_attention -------------------------------------------------------------
-- One row per workspace the caller belongs to, for switcher badges and the overview cards.
-- "Today" is the Indian calendar day, like the rest of the app.

create or replace function public.workspace_attention()
returns table (workspace_id uuid, member_count integer, next_show_date date, tasks_due integer)
language sql stable security definer set search_path = public as $$
  with today as (select (now() at time zone 'Asia/Kolkata')::date as d)
  select
    m.workspace_id,
    (select count(*)::int from public.workspace_members x where x.workspace_id = m.workspace_id),
    (select min(s.show_date) from public.shows s, today where s.workspace_id = m.workspace_id and s.show_date >= today.d),
    (select count(*)::int from public.tasks t, today
      where t.workspace_id = m.workspace_id
        and t.progress <> 'completed'
        and auth.uid() = any (t.assignee_ids)
        and t.due_date is not null
        and t.due_date <= today.d + 7)
  from public.workspace_members m
  where m.user_id = auth.uid();
$$;

revoke all on function public.workspace_attention() from public, anon;
grant execute on function public.workspace_attention() to authenticated;

commit;
