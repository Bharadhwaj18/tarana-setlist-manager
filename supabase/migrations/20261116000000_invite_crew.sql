-- Invite links can make someone Merch crew.
--
-- A crew invite is a member invite whose permissions also carry "merch_crew": true. Whoever joins with it gets the
-- sections ticked on the invite, and in Merch sees only the show kits they're put on (nothing until they're on one).
-- No new tables. Safe to re-run.
--
--   join_with_invite(p_token)   as before, and also passes merch_crew on to a NEW member
--   invite_crew(p_token)        whether an invite makes you Merch crew, for the invite page (the token is the secret)

begin;

create or replace function public.join_with_invite(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_ws uuid;
  v_sections jsonb;
  v_crew boolean;
  v_was_member boolean;
begin
  if auth.uid() is null then raise exception 'Sign in to join'; end if;

  select i.workspace_id, i.permissions -> 'sections', coalesce(i.permissions ->> 'merch_crew' = 'true', false) and i.role <> 'admin'
    into v_ws, v_sections, v_crew
    from public.workspace_invites i where i.token = p_token;
  if v_ws is null then raise exception 'Invite link not found'; end if;

  v_was_member := exists (select 1 from public.workspace_members m where m.workspace_id = v_ws and m.user_id = auth.uid());

  -- All the existing checks (expired, revoked, used up, workspace unavailable) still happen here.
  v_ws := public.accept_workspace_invite(p_token);

  -- Only a NEW member gets the invite's access; someone already in the workspace keeps what they have.
  if not v_was_member then
    update public.workspace_members m
       set permissions = coalesce(m.permissions, '{}'::jsonb)
             || case when v_sections is not null and jsonb_typeof(v_sections) = 'object' then jsonb_build_object('sections', v_sections) else '{}'::jsonb end
             || case when v_crew then jsonb_build_object('merch_crew', true) else '{}'::jsonb end
     where m.workspace_id = v_ws and m.user_id = auth.uid() and m.role not in ('owner', 'admin');
  end if;

  return v_ws;
end $$;

revoke all on function public.join_with_invite(text) from public, anon;
grant execute on function public.join_with_invite(text) to authenticated;

create or replace function public.invite_crew(p_token text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(i.permissions ->> 'merch_crew' = 'true', false) and i.role <> 'admin'
    from public.workspace_invites i where i.token = p_token;
$$;

revoke all on function public.invite_crew(text) from public;
grant execute on function public.invite_crew(text) to anon, authenticated;

commit;
