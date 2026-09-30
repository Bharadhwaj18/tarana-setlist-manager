-- Workspaces, phase 4: onboarding. Create-a-band, invite links, accept, safer member management.
-- Additive except section 4, which TIGHTENS three policies on the workspace tables (see there).
-- One transaction; safe to re-run.

begin;

-- ---------- 1. Invite links ----------
create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  role text not null default 'member' check (role in ('admin', 'member')),
  permissions jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid(),
  expires_at timestamptz not null default now() + interval '7 days',
  max_uses integer check (max_uses is null or max_uses > 0),
  use_count integer not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists workspace_invites_workspace_idx on public.workspace_invites(workspace_id);

alter table public.workspace_invites enable row level security;

-- Admins of a workspace can list and create its invites. Revoking goes through revoke_workspace_invite();
-- accepting goes through accept_workspace_invite(). There is deliberately no update/delete policy.
drop policy if exists invites_select on public.workspace_invites;
create policy invites_select on public.workspace_invites for select to authenticated
  using (public.is_workspace_admin(workspace_id));

drop policy if exists invites_insert on public.workspace_invites;
create policy invites_insert on public.workspace_invites for insert to authenticated
  with check (
    public.is_workspace_admin(workspace_id)
    and public.workspace_access(workspace_id) = 'full'
    and created_by = auth.uid()
    and use_count = 0 and revoked_at is null
    and expires_at <= now() + interval '31 days'
    and (select w.type from public.workspaces w where w.id = workspace_id) <> 'personal'
  );

-- ---------- 2. Functions ----------
-- Create a workspace you own. (Direct inserts into workspaces are closed below.)
create or replace function public.create_workspace(p_name text, p_type text default 'band')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  clean text := btrim(coalesce(p_name, ''));
  ws uuid;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if char_length(clean) < 1 or char_length(clean) > 60 then raise exception 'Name must be 1-60 characters'; end if;
  if p_type <> 'band' then raise exception 'Unsupported workspace type'; end if;
  if (select count(*) from public.workspaces w where w.owner_id = uid and w.type <> 'personal') >= 10 then
    raise exception 'You have reached the limit of 10 workspaces';
  end if;
  insert into public.workspaces (name, type, owner_id) values (clean, p_type, uid) returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, uid, 'owner');
  return ws;
end $$;

create or replace function public.rename_workspace(p_ws uuid, p_name text)
returns void language plpgsql security definer set search_path = public as $$
declare clean text := btrim(coalesce(p_name, ''));
begin
  if not public.is_workspace_admin(p_ws) then raise exception 'Only an admin can rename this workspace'; end if;
  if (select type from public.workspaces where id = p_ws) = 'personal' then raise exception 'Personal spaces cannot be renamed'; end if;
  if char_length(clean) < 1 or char_length(clean) > 60 then raise exception 'Name must be 1-60 characters'; end if;
  update public.workspaces set name = clean where id = p_ws;
end $$;

create or replace function public.revoke_workspace_invite(p_invite uuid)
returns void language plpgsql security definer set search_path = public as $$
declare ws uuid;
begin
  select workspace_id into ws from public.workspace_invites where id = p_invite;
  if ws is null or not public.is_workspace_admin(ws) then raise exception 'Invite not found'; end if;
  update public.workspace_invites set revoked_at = coalesce(revoked_at, now()) where id = p_invite;
end $$;

-- What the invite page shows before anyone signs in. The token is the secret; knowing it reveals
-- only the workspace name and whether the link still works.
create or replace function public.invite_preview(p_token text)
returns table (workspace_name text, workspace_type text, state text)
language sql stable security definer set search_path = public as $$
  select w.name, w.type,
    case
      when i.revoked_at is not null then 'revoked'
      when i.expires_at <= now() then 'expired'
      when i.max_uses is not null and i.use_count >= i.max_uses then 'used_up'
      when w.type = 'personal' or public.workspace_access(w.id) <> 'full' then 'unavailable'
      else 'valid'
    end
  from public.workspace_invites i join public.workspaces w on w.id = i.workspace_id
  where i.token = p_token;
$$;

commit;
