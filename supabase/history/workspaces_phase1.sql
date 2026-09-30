-- Workspaces, phase 1: ADDITIVE ONLY. Nothing here changes what the app can see or do:
-- existing RLS policies are untouched, new columns are nullable, and a trigger keeps
-- filling workspace_id for inserts the app doesn't know about yet. Safe to re-run.

-- 1. Core tables ---------------------------------------------------------------
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'band',              -- personal | band | (troupe, class, ... later; free text on purpose)
  owner_id uuid not null,
  -- billing / lifecycle (all inert until we enforce them)
  plan text not null default 'free',
  status text not null default 'active',          -- active | past_due | read_only | blocked
  trial_ends_at timestamptz,
  past_due_since timestamptz,
  read_only_until timestamptz,
  blocked_at timestamptz,
  settings jsonb not null default '{}'::jsonb,    -- room for per-workspace config (grace lengths, branding, ...)
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member',            -- owner | admin | member
  permissions jsonb not null default '{}'::jsonb, -- e.g. {"treasurer": true}; roles differ per vertical, so keep it open
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index if not exists workspace_members_user_idx on public.workspace_members(user_id);

-- Lookup of feature gates per plan, so paid unlocks never need code changes.
create table if not exists public.plan_features (
  plan text not null,
  feature text not null,
  value jsonb not null default 'true'::jsonb,
  primary key (plan, feature)
);

-- 2. Helper functions (security definer so RLS on workspace_members can't recurse) ---
create or replace function public.is_workspace_member(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workspace_members m where m.workspace_id = ws and m.user_id = auth.uid());
$$;

create or replace function public.is_workspace_admin(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid() and m.role in ('owner', 'admin'));
$$;

-- 'full' | 'read_only' | 'none'. Personal workspaces are always full.
create or replace function public.workspace_access(ws uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when w.type = 'personal' then 'full'
    when w.status = 'blocked' or (w.blocked_at is not null and w.blocked_at <= now()) then 'none'
    when w.status = 'read_only' or (w.read_only_until is not null and w.read_only_until <= now()) then 'read_only'
    else 'full'
  end
  from public.workspaces w where w.id = ws;
$$;

-- The workspace an insert lands in when the app doesn't say (transition period only).
-- Prefers a band workspace over the personal one, oldest membership first.
create or replace function public.default_workspace_id(uid uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select m.workspace_id from public.workspace_members m
  join public.workspaces w on w.id = m.workspace_id
  where m.user_id = uid
  order by (w.type = 'personal'), m.created_at
  limit 1;
$$;

-- 3. Seed: the existing Tarana data becomes the first workspace ----------------
do $$
declare
  tarana uuid;
  owner uuid;
begin
  select id into tarana from public.workspaces where name = 'Tarana' and type = 'band' limit 1;
  if tarana is null then
    select id into owner from public.profiles where role = 'treasurer' order by created_at limit 1;
    if owner is null then select id into owner from public.profiles order by created_at limit 1; end if;
    if owner is not null then
      insert into public.workspaces (name, type, owner_id) values ('Tarana', 'band', owner) returning id into tarana;
    end if;
  end if;

  if tarana is not null then
    insert into public.workspace_members (workspace_id, user_id, role, permissions)
    select tarana, p.id,
      case when p.id = (select owner_id from public.workspaces where id = tarana) then 'owner' else 'member' end,
      case when p.role = 'treasurer' then '{"treasurer": true}'::jsonb else '{}'::jsonb end
    from public.profiles p
    on conflict do nothing;
  end if;

  -- One personal workspace per user.
  insert into public.workspaces (name, type, owner_id)
  select coalesce(p.display_name, 'Me') || '''s space', 'personal', p.id
  from public.profiles p
  where not exists (select 1 from public.workspaces w where w.type = 'personal' and w.owner_id = p.id);

  insert into public.workspace_members (workspace_id, user_id, role)
  select w.id, w.owner_id, 'owner' from public.workspaces w where w.type = 'personal'
  on conflict do nothing;
end $$;

-- New users get a personal workspace automatically.
create or replace function public.create_personal_workspace()
returns trigger language plpgsql security definer set search_path = public as $$
declare ws uuid;
begin
  insert into public.workspaces (name, type, owner_id)
  values (coalesce(new.display_name, 'Me') || '''s space', 'personal', new.id) returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, new.id, 'owner');
  return new;
end $$;
drop trigger if exists profiles_create_personal_workspace on public.profiles;
create trigger profiles_create_personal_workspace after insert on public.profiles
  for each row execute function public.create_personal_workspace();

-- 4. workspace_id on every top-level table: nullable, backfilled, auto-filled on insert ---
create or replace function public.set_default_workspace()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.workspace_id is null then
    new.workspace_id := public.default_workspace_id(auth.uid());
  end if;
  return new;
end $$;

do $$
declare
  t text;
  tarana uuid;
begin
  select id into tarana from public.workspaces where name = 'Tarana' and type = 'band' limit 1;
  foreach t in array array[
    'songs', 'setlists', 'shows', 'event_management', 'notes', 'finance_transactions',
    'pending_payments', 'budgets', 'split_runs', 'calendar_events', 'unavailability', 'recordings'
  ] loop
    if to_regclass('public.' || t) is null then continue; end if;  -- e.g. recordings if its migration hasn't run
    execute format('alter table public.%I add column if not exists workspace_id uuid references public.workspaces(id)', t);
    execute format('create index if not exists %I on public.%I(workspace_id)', t || '_workspace_id_idx', t);
    if tarana is not null then
      execute format('update public.%I set workspace_id = $1 where workspace_id is null', t) using tarana;
    end if;
    execute format('drop trigger if exists %I on public.%I', t || '_default_workspace', t);
    execute format('create trigger %I before insert on public.%I for each row execute function public.set_default_workspace()', t || '_default_workspace', t);
  end loop;
end $$;

-- 5. RLS for the new tables only -------------------------------------------------
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.plan_features enable row level security;

drop policy if exists workspaces_select on public.workspaces;
create policy workspaces_select on public.workspaces for select to authenticated using (public.is_workspace_member(id));
drop policy if exists workspaces_insert on public.workspaces;
create policy workspaces_insert on public.workspaces for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists workspaces_update on public.workspaces;
create policy workspaces_update on public.workspaces for update to authenticated
  using (public.is_workspace_admin(id)) with check (public.is_workspace_admin(id));

drop policy if exists members_select on public.workspace_members;
create policy members_select on public.workspace_members for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists members_write on public.workspace_members;
create policy members_write on public.workspace_members for all to authenticated
  using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));

drop policy if exists plan_features_read on public.plan_features;
create policy plan_features_read on public.plan_features for select to authenticated using (true);
