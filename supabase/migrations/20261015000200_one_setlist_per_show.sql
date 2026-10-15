-- A show has at most one setlist. The app already enforces this; this makes the database enforce it too.
-- Safe to re-run. If some show already has two setlists the index is skipped (with a notice) so nothing breaks:
-- merge or delete the extra setlist, then run this again.
do $$
begin
  if exists (select 1 from public.setlists where show_id is not null group by show_id having count(*) > 1) then
    raise notice 'Skipped: some shows already have more than one setlist. Remove the extras and run this again.';
  else
    create unique index if not exists setlists_one_per_show on public.setlists (show_id) where show_id is not null;
  end if;
end $$;
