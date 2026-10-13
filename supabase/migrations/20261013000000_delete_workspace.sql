-- Lets an owner/admin permanently delete a (non-personal) workspace and everything in it.
-- Additive and safe to re-run.
--
-- 1. Every table's workspace_id foreign key becomes ON DELETE CASCADE, so deleting the
--    workspace row removes its songs, setlists, shows, finance, notes, tasks, ... (child
--    tables already cascade from their parents). The foreign keys that already cascade
--    (members, invites, tasks, show_documents, ...) are left alone.
-- 2. delete_workspace(p_ws) does the permission check and the delete. Personal spaces
--    can't be deleted. Uploaded files (recordings, show documents) live in storage and are
--    removed by the app after this succeeds.

begin;

do $$
declare r record;
begin
  for r in
    select c.conrelid::regclass as tbl, c.conname, pg_get_constraintdef(c.oid) as def
    from pg_constraint c
    where c.contype = 'f'
      and c.confrelid = 'public.workspaces'::regclass
      and c.conrelid <> 'public.workspaces'::regclass
      and c.confdeltype = 'a'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format('alter table %s add constraint %I %s on delete cascade', r.tbl, r.conname, r.def);
  end loop;
end $$;

create or replace function public.delete_workspace(p_ws uuid)
returns void language plpgsql security definer set search_path = public as $$
declare ws_type text;
begin
  select type into ws_type from public.workspaces where id = p_ws;
  if ws_type is null then
    raise exception 'workspace not found';
  end if;
  if ws_type = 'personal' then
    raise exception 'a personal space can''t be deleted';
  end if;
  if not exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_ws and m.user_id = auth.uid() and m.role in ('owner', 'admin')
  ) then
    raise exception 'only a workspace admin can delete it';
  end if;
  delete from public.workspaces where id = p_ws;
end $$;

revoke all on function public.delete_workspace(uuid) from public, anon;
grant execute on function public.delete_workspace(uuid) to authenticated;

commit;
