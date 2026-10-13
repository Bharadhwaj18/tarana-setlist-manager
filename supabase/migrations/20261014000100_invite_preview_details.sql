-- Richer invite page: the workspace's colour and logo, who invited you, the role you'd get, when the link
-- expires and how many people are already in. Still callable before sign-in (the token is the secret).
-- Run AFTER 20261014000000_workspace_profile.sql (it needs the colour and avatar columns). Safe to re-run.

begin;

drop function if exists public.invite_preview(text);

create function public.invite_preview(p_token text)
returns table (
  workspace_name text,
  workspace_type text,
  state text,
  workspace_color text,
  workspace_avatar_url text,
  invited_by_name text,
  invite_role text,
  expires_at timestamptz,
  member_count integer
)
language sql stable security definer set search_path = public as $$
  select w.name, w.type,
    case
      when i.revoked_at is not null then 'revoked'
      when i.expires_at <= now() then 'expired'
      when i.max_uses is not null and i.use_count >= i.max_uses then 'used_up'
      when w.type = 'personal' or public.workspace_access(w.id) <> 'full' then 'unavailable'
      else 'valid'
    end,
    w.color,
    w.avatar_url,
    nullif(btrim(p.display_name), ''),
    i.role,
    i.expires_at,
    (select count(*)::integer from public.workspace_members m where m.workspace_id = w.id)
  from public.workspace_invites i
  join public.workspaces w on w.id = i.workspace_id
  left join public.profiles p on p.id = i.created_by
  where i.token = p_token;
$$;

revoke all on function public.invite_preview(text) from public;
grant execute on function public.invite_preview(text) to anon, authenticated;

commit;
