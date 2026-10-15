-- Invite links carry the access the new member gets, so admins don't have to set it after they join.
-- The access is stored on workspace_invites.permissions -> 'sections' (same shape as a member's).
-- Additive and safe to re-run; accept_workspace_invite itself is unchanged.
--
--   join_with_invite(p_token)   accepts the invite, then gives a NEW member the invite's access.
--                               Someone already in the workspace keeps the access they have.
--   invite_sections(p_token)    the access an invite gives, for the invite page (the token is the secret).

begin;

create or replace function public.join_with_invite(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_ws uuid;
  v_sections jsonb;
  v_was_member boolean;
begin
  if auth.uid() is null then raise exception 'Sign in to join'; end if;

  select i.workspace_id, i.permissions -> 'sections' into v_ws, v_sections
    from public.workspace_invites i where i.token = p_token;
  if v_ws is null then raise exception 'Invite link not found'; end if;

  v_was_member := exists (select 1 from public.workspace_members m where m.workspace_id = v_ws and m.user_id = auth.uid());

  -- All the existing checks (expired, revoked, used up, workspace unavailable) still happen here.
  v_ws := public.accept_workspace_invite(p_token);

  if not v_was_member and v_sections is not null and jsonb_typeof(v_sections) = 'object' then
    update public.workspace_members m
       set permissions = coalesce(m.permissions, '{}'::jsonb) || jsonb_build_object('sections', v_sections)
     where m.workspace_id = v_ws and m.user_id = auth.uid() and m.role not in ('owner', 'admin');
  end if;

  return v_ws;
end $$;

revoke all on function public.join_with_invite(text) from public, anon;
grant execute on function public.join_with_invite(text) to authenticated;

create or replace function public.invite_sections(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when i.role = 'admin' then null else i.permissions -> 'sections' end
    from public.workspace_invites i where i.token = p_token;
$$;

revoke all on function public.invite_sections(text) from public;
grant execute on function public.invite_sections(text) to anon, authenticated;

commit;
