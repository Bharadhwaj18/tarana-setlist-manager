-- Security hardening. Safe to re-run. Nothing here changes what signed-in users can do today.
--  1. RLS helper functions were executable by anon (Supabase grants new functions to anon explicitly).
--  2. Workspace RPCs: same. They check auth.uid() internally, but there is no reason to expose them.
--  3. workspace_members: admins could rewrite user_id / workspace_id on a row. Now only role and permissions are updatable.
--  invite_preview stays callable by anon on purpose (the invite page shows the workspace name before sign-in).

begin;

revoke all on function public.is_workspace_member(uuid) from public, anon;
revoke all on function public.is_workspace_admin(uuid) from public, anon;
revoke all on function public.workspace_access(uuid) from public, anon;
revoke all on function public.default_workspace_id(uuid) from public, anon;
revoke all on function public.shares_workspace_with(uuid) from public, anon;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_admin(uuid) to authenticated;
grant execute on function public.workspace_access(uuid) to authenticated;
grant execute on function public.default_workspace_id(uuid) to authenticated;
grant execute on function public.shares_workspace_with(uuid) to authenticated;

revoke all on function public.create_workspace(text, text) from anon;
revoke all on function public.rename_workspace(uuid, text) from anon;
revoke all on function public.revoke_workspace_invite(uuid) from anon;
revoke all on function public.accept_workspace_invite(text) from anon;

revoke update on public.workspace_members from anon, authenticated;
grant update (role, permissions) on public.workspace_members to authenticated;

commit;

-- Check: helper grants should list no anon row.
select routine_name, grantee
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in ('is_workspace_member', 'is_workspace_admin', 'workspace_access', 'default_workspace_id',
                       'shares_workspace_with', 'create_workspace', 'rename_workspace',
                       'revoke_workspace_invite', 'accept_workspace_invite')
  and grantee in ('anon', 'PUBLIC')
order by 1, 2;
