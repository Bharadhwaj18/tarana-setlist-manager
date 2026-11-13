-- The workspace switcher's "N members" no longer counts Merch crew: they only ever show up in Merch.
-- Also, the "next show" hint is only given to people who can open Shows, so crew (and anyone with Shows
-- hidden) don't learn show dates from the switcher.
-- Same signature and grants as before. Safe to re-run.

begin;

create or replace function public.workspace_attention()
returns table (workspace_id uuid, member_count integer, next_show_date date, tasks_due integer)
language sql stable security definer set search_path = public as $$
  with today as (select (now() at time zone 'Asia/Kolkata')::date as d)
  select
    m.workspace_id,
    (select count(*)::int from public.workspace_members x
      where x.workspace_id = m.workspace_id
        and not (x.role not in ('owner', 'admin') and coalesce(x.permissions ->> 'merch_crew', 'false') = 'true')),
    case when public.section_level(m.workspace_id, 'shows') <> 'none' then
      (select min(s.show_date) from public.shows s, today where s.workspace_id = m.workspace_id and s.show_date >= today.d)
    end,
    (select count(*)::int from public.tasks t, today
      where t.workspace_id = m.workspace_id
        and t.progress <> 'completed'
        and auth.uid() = any (t.assignee_ids)
        and t.due_date is not null
        and t.due_date <= today.d + 7)
  from public.workspace_members m
  where m.user_id = auth.uid();
$$;

revoke all on function public.workspace_attention() from public, anon;
grant execute on function public.workspace_attention() to authenticated;
grant execute on function public.workspace_attention() to service_role;

commit;
