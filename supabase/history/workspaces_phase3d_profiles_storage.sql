-- Workspaces, phase 3d: close the two leftover holes.
--  1. profiles: was readable by every signed-in user. Now: yourself + people you share a workspace with.
--  2. recordings storage bucket: was open to every signed-in user. Now: files are readable/deletable only
--     via a recordings row in a workspace you belong to (or your own upload folder); uploads only into
--     your own folder (the app uploads to "<your user id>/<file>").
-- One transaction: any error leaves everything unchanged. Safe to re-run.

begin;

-- ---------- 1. profiles ----------
create or replace function public.shares_workspace_with(other uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members a
    join public.workspace_members b on b.workspace_id = a.workspace_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;
grant execute on function public.shares_workspace_with(uuid) to authenticated;

-- Remove old read policies (SELECT-only ones, and catch-all ones which we re-create write-side below).
do $$
declare r record; had_all boolean := false;
begin
  for r in select policyname, cmd from pg_policies
           where schemaname = 'public' and tablename = 'profiles'
             and policyname not in ('ps_select', 'ps_insert_self', 'ps_update_self')
             and cmd in ('SELECT', 'ALL')
  loop
    if r.cmd = 'ALL' then had_all := true; end if;
    execute format('drop policy %I on public.profiles', r.policyname);
  end loop;

  execute 'drop policy if exists ps_select on public.profiles';
  execute $p$create policy ps_select on public.profiles for select to authenticated
    using (id = auth.uid() or public.shares_workspace_with(id))$p$;

  if had_all then
    execute 'drop policy if exists ps_insert_self on public.profiles';
    execute $p$create policy ps_insert_self on public.profiles for insert to authenticated
      with check (id = auth.uid())$p$;
    execute 'drop policy if exists ps_update_self on public.profiles';
    execute $p$create policy ps_update_self on public.profiles for update to authenticated
      using (id = auth.uid()) with check (id = auth.uid())$p$;
  end if;
end $$;

alter table public.profiles enable row level security;

-- ---------- 2. recordings storage bucket ----------
do $$
declare r record;
begin
  for r in select policyname from pg_policies
           where schemaname = 'storage' and tablename = 'objects'
             and (coalesce(qual, '') like '%recordings%' or coalesce(with_check, '') like '%recordings%')
             and policyname not like 'ws\_rec\_%'
  loop
    execute format('drop policy %I on storage.objects', r.policyname);
  end loop;
end $$;

drop policy if exists ws_rec_select on storage.objects;
create policy ws_rec_select on storage.objects for select to authenticated using (
  bucket_id = 'recordings' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.recordings r
               where r.file_path = storage.objects.name
                 and public.is_workspace_member(r.workspace_id)
                 and public.workspace_access(r.workspace_id) <> 'none')
  ));

drop policy if exists ws_rec_insert on storage.objects;
create policy ws_rec_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists ws_rec_delete on storage.objects;
create policy ws_rec_delete on storage.objects for delete to authenticated using (
  bucket_id = 'recordings' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.recordings r
               where r.file_path = storage.objects.name
                 and public.is_workspace_member(r.workspace_id)
                 and public.workspace_access(r.workspace_id) = 'full')
  ));

commit;

-- Result: policies now on profiles and on storage.objects for the recordings bucket.
select 'profiles' as scope, policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'profiles'
union all
select 'storage.objects', policyname, cmd from pg_policies
 where schemaname = 'storage' and tablename = 'objects' and policyname like 'ws\_rec\_%'
order by 1, 2;
