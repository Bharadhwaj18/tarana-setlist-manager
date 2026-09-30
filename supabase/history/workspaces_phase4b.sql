-- Workspaces, phase 4 (part 2 of 2): accept function, grants, member policies, tighten workspaces.
-- Run AFTER part 1. One transaction; safe to re-run.

begin;

-- Join a workspace through an invite link. Idempotent for people already in it.
create or replace function public.accept_workspace_invite(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  inv public.workspace_invites%rowtype;
  wtype text;
  added integer;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select * into inv from public.workspace_invites where token = p_token for update;
  if not found then raise exception 'This invite link is not valid'; end if;
  if inv.revoked_at is not null then raise exception 'This invite link was cancelled'; end if;
  if inv.expires_at <= now() then raise exception 'This invite link has expired'; end if;
  select type into wtype from public.workspaces where id = inv.workspace_id;
  if wtype = 'personal' or public.workspace_access(inv.workspace_id) <> 'full' then
    raise exception 'This workspace is not accepting new members right now';
  end if;

  if exists (select 1 from public.workspace_members m where m.workspace_id = inv.workspace_id and m.user_id = uid) then
    return inv.workspace_id;
  end if;
  if inv.max_uses is not null and inv.use_count >= inv.max_uses then raise exception 'This invite link has been used up'; end if;

  insert into public.workspace_members (workspace_id, user_id, role, permissions)
  values (inv.workspace_id, uid, inv.role, inv.permissions)
  on conflict do nothing;
  get diagnostics added = row_count;
  if added > 0 then
    update public.workspace_invites set use_count = use_count + 1 where id = inv.id;
  end if;
  return inv.workspace_id;
end $$;

revoke all on function public.create_workspace(text, text) from public;
revoke all on function public.rename_workspace(uuid, text) from public;
revoke all on function public.revoke_workspace_invite(uuid) from public;
revoke all on function public.invite_preview(text) from public;
revoke all on function public.accept_workspace_invite(text) from public;
grant execute on function public.create_workspace(text, text) to authenticated;
grant execute on function public.rename_workspace(uuid, text) to authenticated;
grant execute on function public.revoke_workspace_invite(uuid) to authenticated;
grant execute on function public.accept_workspace_invite(text) to authenticated;
grant execute on function public.invite_preview(text) to anon, authenticated;

-- ---------- 3. Member management policies ----------
-- Members can be listed by anyone in the workspace (members_select, unchanged). Adding members happens ONLY
-- through accept_workspace_invite()/create_workspace(). Admins may edit or remove non-owners; anyone may leave
-- (except the owner, who must hand over first).
drop policy if exists members_write on public.workspace_members;
drop policy if exists members_update on public.workspace_members;
create policy members_update on public.workspace_members for update to authenticated
  using (public.is_workspace_admin(workspace_id) and role <> 'owner')
  with check (public.is_workspace_admin(workspace_id) and role in ('admin', 'member'));

drop policy if exists members_delete on public.workspace_members;
create policy members_delete on public.workspace_members for delete to authenticated
  using (
    role <> 'owner'
    and (public.is_workspace_admin(workspace_id) or user_id = auth.uid())
    and (select w.type from public.workspaces w where w.id = workspace_id) <> 'personal'
  );

-- ---------- 4. Tighten the workspaces table ----------
-- The phase-1 policies let an admin edit ANY column (plan, status, owner) and let any user insert a workspace
-- with any plan. Both now go through the functions above; billing columns become server-only.
drop policy if exists workspaces_insert on public.workspaces;
drop policy if exists workspaces_update on public.workspaces;

commit;

-- Check: should list the functions and the policies just created.
select 'function' as kind, proname as name from pg_proc
  where pronamespace = 'public'::regnamespace
    and proname in ('create_workspace','rename_workspace','revoke_workspace_invite','invite_preview','accept_workspace_invite')
union all
select 'policy: ' || tablename, policyname from pg_policies
  where schemaname = 'public' and tablename in ('workspaces','workspace_members','workspace_invites')
order by 1, 2;
