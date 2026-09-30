-- Workspaces, phase 5: per-event calendar visibility + cross-workspace "busy" feed.
-- Additive and safe to re-run. Nothing existing changes for in-workspace users.
--
--  visibility (on shows, calendar_events, unavailability) controls what people in OTHER
--  workspaces see of an item, via members you share with them:
--    hidden  = not shown outside its own workspace
--    busy    = shown as a "busy" block, no title/venue/reason
--    details = shown in full
--  Default is 'busy' (time blocked, nothing else leaks).
--
--  calendar_external(ws) returns the already-redacted rows for the calendar of workspace `ws`:
--  items from OTHER workspaces that a member of `ws` also belongs to, one row per shared member.
--  Redaction happens inside the function, so a client can never read hidden fields through it.

begin;

alter table public.shows
  add column if not exists visibility text not null default 'busy'
  check (visibility in ('hidden', 'busy', 'details'));
alter table public.calendar_events
  add column if not exists visibility text not null default 'busy'
  check (visibility in ('hidden', 'busy', 'details'));
alter table public.unavailability
  add column if not exists visibility text not null default 'busy'
  check (visibility in ('hidden', 'busy', 'details'));

create or replace function public.calendar_external(p_ws uuid)
returns table (
  kind text, item_id uuid, member_id uuid, source_name text,
  start_date date, end_date date, visibility text, title text, detail text
)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_workspace_member(p_ws) then
    return;
  end if;

  return query
  with shared as (
    select other.user_id, other.workspace_id as src
    from public.workspace_members here
    join public.workspace_members other
      on other.user_id = here.user_id and other.workspace_id <> p_ws
    where here.workspace_id = p_ws
      and public.workspace_access(other.workspace_id) <> 'none'
  )
  select 'show'::text, s.id, sh.user_id,
         case when s.visibility = 'details' then w.name end,
         s.show_date::date, s.show_date::date, s.visibility,
         case when s.visibility = 'details' then s.title end,
         case when s.visibility = 'details' then s.venue end
  from shared sh
  join public.shows s on s.workspace_id = sh.src
  join public.workspaces w on w.id = sh.src
  where s.visibility <> 'hidden' and s.show_date is not null
  union all
  select 'event'::text, e.id, sh.user_id,
         case when e.visibility = 'details' then w.name end,
         e.start_date::date, e.end_date::date, e.visibility,
         case when e.visibility = 'details' then e.title end,
         case when e.visibility = 'details' then e.notes end
  from shared sh
  join public.calendar_events e on e.workspace_id = sh.src
  join public.workspaces w on w.id = sh.src
  where e.visibility <> 'hidden'
  union all
  select 'unavailable'::text, u.id, u.member_id,
         case when u.visibility = 'details' then w.name end,
         u.start_date::date, u.end_date::date, u.visibility,
         null::text,
         case when u.visibility = 'details' then u.reason end
  from shared sh
  join public.unavailability u on u.workspace_id = sh.src and u.member_id = sh.user_id
  join public.workspaces w on w.id = sh.src
  where u.visibility <> 'hidden';
end;
$$;

revoke all on function public.calendar_external(uuid) from public, anon;
grant execute on function public.calendar_external(uuid) to authenticated;

commit;

-- Sanity check (as yourself, replace the uuid with one of your workspace ids):
-- select * from public.calendar_external('<workspace-id>');
