-- Configurable finance: per-workspace money settings, tags, projects and recurring entries.
-- Additive and safe to re-run. Nothing existing changes behaviour: a workspace with no saved
-- finance settings keeps today's categories, 20% fund cut and equal split.
--
--   workspaces.settings -> 'finance'          (written only through set_finance_settings, admins only)
--   finance_projects                          (tours, albums: a name, dates and an optional budget)
--   finance_recurring                         (rent, retainers: entries that repeat on a schedule)
--   finance_transactions.tags / project_id / recurring_id
--   rename_finance_tag(p_ws, p_old, p_new)    (rename or, with p_new null, remove a tag everywhere)

begin;

-- 1. Settings ------------------------------------------------------------------------

create or replace function public.set_finance_settings(p_ws uuid, p_settings jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_workspace_admin(p_ws) then raise exception 'Only an admin can change money settings'; end if;
  if p_settings is null or jsonb_typeof(p_settings) <> 'object' then raise exception 'Invalid settings'; end if;
  if char_length(p_settings::text) > 50000 then raise exception 'Settings are too large'; end if;

  update public.workspaces w
     set settings = jsonb_set(coalesce(w.settings, '{}'::jsonb), '{finance}', p_settings, true)
   where w.id = p_ws;
end $$;

revoke all on function public.set_finance_settings(uuid, jsonb) from public, anon;
grant execute on function public.set_finance_settings(uuid, jsonb) to authenticated;

-- 2. Projects ------------------------------------------------------------------------

create table if not exists public.finance_projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  start_date date,
  end_date date,
  budget numeric check (budget is null or budget >= 0),
  archived_at timestamptz,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists finance_projects_ws_idx on public.finance_projects (workspace_id);

-- 3. Recurring entries ---------------------------------------------------------------

create table if not exists public.finance_recurring (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  description text not null check (char_length(btrim(description)) between 1 and 200),
  amount numeric not null check (amount <> 0),
  category text,
  member_id uuid,
  project_id uuid references public.finance_projects(id) on delete set null,
  frequency text not null check (frequency in ('weekly', 'monthly', 'yearly')),
  start_date date not null,
  end_date date,
  paused boolean not null default false,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists finance_recurring_ws_idx on public.finance_recurring (workspace_id);

-- 4. Transaction columns -------------------------------------------------------------

alter table public.finance_transactions add column if not exists tags text[] not null default '{}';
alter table public.finance_transactions add column if not exists project_id uuid references public.finance_projects(id) on delete set null;
alter table public.finance_transactions add column if not exists recurring_id uuid references public.finance_recurring(id) on delete set null;

-- One entry per rule per date, so generating recurring entries twice never doubles them.
-- Rows without a rule have recurring_id null and never collide.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'finance_transactions_recurring_date_key') then
    alter table public.finance_transactions
      add constraint finance_transactions_recurring_date_key unique (recurring_id, date);
  end if;
end $$;

create index if not exists finance_transactions_project_idx on public.finance_transactions (project_id) where project_id is not null;
create index if not exists finance_transactions_tags_idx on public.finance_transactions using gin (tags);

-- 5. Row level security: same rules as every workspace table, plus the Finance section level ---

do $$
declare t text;
begin
  foreach t in array array['finance_projects', 'finance_recurring'] loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists ws_select on public.%I', t);
    execute format($p$create policy ws_select on public.%I for select to authenticated
      using (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) <> 'none')$p$, t);

    execute format('drop policy if exists ws_insert on public.%I', t);
    execute format($p$create policy ws_insert on public.%I for insert to authenticated
      with check (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = 'full')$p$, t);

    execute format('drop policy if exists ws_update on public.%I', t);
    execute format($p$create policy ws_update on public.%I for update to authenticated
      using (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = 'full')
      with check (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = 'full')$p$, t);

    execute format('drop policy if exists ws_delete on public.%I', t);
    execute format($p$create policy ws_delete on public.%I for delete to authenticated
      using (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = 'full')$p$, t);

    execute format('drop policy if exists ws_section_read on public.%I', t);
    execute format($p$create policy ws_section_read on public.%I as restrictive for select to authenticated
      using (public.section_level(workspace_id, 'finance') <> 'none')$p$, t);

    execute format('drop policy if exists ws_section_insert on public.%I', t);
    execute format($p$create policy ws_section_insert on public.%I as restrictive for insert to authenticated
      with check (public.section_level(workspace_id, 'finance') = 'edit')$p$, t);

    execute format('drop policy if exists ws_section_update on public.%I', t);
    execute format($p$create policy ws_section_update on public.%I as restrictive for update to authenticated
      using (public.section_level(workspace_id, 'finance') = 'edit')
      with check (public.section_level(workspace_id, 'finance') = 'edit')$p$, t);

    execute format('drop policy if exists ws_section_delete on public.%I', t);
    execute format($p$create policy ws_section_delete on public.%I as restrictive for delete to authenticated
      using (public.section_level(workspace_id, 'finance') = 'edit')$p$, t);

    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- 6. Tags ----------------------------------------------------------------------------
-- Runs as the caller, so the normal row rules decide which entries it can change.

create or replace function public.rename_finance_tag(p_ws uuid, p_old text, p_new text default null)
returns void language plpgsql security invoker set search_path = public as $$
declare clean text := nullif(btrim(coalesce(p_new, '')), '');
begin
  if clean is null then
    update public.finance_transactions set tags = array_remove(tags, p_old)
     where workspace_id = p_ws and p_old = any(tags);
  else
    update public.finance_transactions
       set tags = (select array_agg(distinct x) from unnest(array_replace(tags, p_old, clean)) as x)
     where workspace_id = p_ws and p_old = any(tags);
  end if;
end $$;

revoke all on function public.rename_finance_tag(uuid, text, text) from public, anon;
grant execute on function public.rename_finance_tag(uuid, text, text) to authenticated;

-- Grants: Supabase no longer opens new tables to the API on its own (from 2026-10-30), so say who may reach them.
-- Row-level security above still decides which rows; logged-out visitors get nothing.
grant select, insert, update, delete on public.finance_projects to authenticated;
grant select, insert, update, delete on public.finance_projects to service_role;
grant select, insert, update, delete on public.finance_recurring to authenticated;
grant select, insert, update, delete on public.finance_recurring to service_role;

commit;
