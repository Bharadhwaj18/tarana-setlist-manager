-- Integrity: stop a row from pointing at a parent in a DIFFERENT workspace, and constrain free-text enums.
-- Triggers only check new/changed rows, so existing data is untouched. Safe to re-run.

begin;

create or replace function public.check_same_workspace()
returns trigger language plpgsql as $$
declare
  parent_ws uuid;
begin
  -- TG_ARGV: parent table, foreign-key column on this row
  execute format('select workspace_id from public.%I where id = $1', TG_ARGV[0])
    into parent_ws using (to_jsonb(new) ->> TG_ARGV[1])::uuid;
  if parent_ws is not null and parent_ws is distinct from new.workspace_id then
    raise exception 'Cannot link across workspaces (% -> %)', TG_TABLE_NAME, TG_ARGV[0];
  end if;
  return new;
end $$;

-- Named zz_ so they fire after the *_default_workspace triggers that fill workspace_id.
drop trigger if exists zz_ws_check_show on public.finance_transactions;
create trigger zz_ws_check_show before insert or update of show_id, workspace_id on public.finance_transactions
  for each row when (new.show_id is not null) execute function public.check_same_workspace('shows', 'show_id');

drop trigger if exists zz_ws_check_budget on public.finance_transactions;
create trigger zz_ws_check_budget before insert or update of budget_id, workspace_id on public.finance_transactions
  for each row when (new.budget_id is not null) execute function public.check_same_workspace('budgets', 'budget_id');

drop trigger if exists zz_ws_check_show on public.pending_payments;
create trigger zz_ws_check_show before insert or update of show_id, workspace_id on public.pending_payments
  for each row when (new.show_id is not null) execute function public.check_same_workspace('shows', 'show_id');

drop trigger if exists zz_ws_check_show on public.setlists;
create trigger zz_ws_check_show before insert or update of show_id, workspace_id on public.setlists
  for each row when (new.show_id is not null) execute function public.check_same_workspace('shows', 'show_id');

drop trigger if exists zz_ws_check_show on public.show_documents;
create trigger zz_ws_check_show before insert or update of show_id, workspace_id on public.show_documents
  for each row execute function public.check_same_workspace('shows', 'show_id');

drop trigger if exists zz_ws_check_song on public.recordings;
create trigger zz_ws_check_song before insert or update of song_id, workspace_id on public.recordings
  for each row when (new.song_id is not null) execute function public.check_same_workspace('songs', 'song_id');

-- Setlist rows: the song and the setlist must live in the same workspace.
create or replace function public.check_setlist_song_workspace()
returns trigger language plpgsql as $$
declare
  song_ws uuid;
  list_ws uuid;
begin
  select workspace_id into song_ws from public.songs where id = new.song_id;
  select workspace_id into list_ws from public.setlists where id = new.setlist_id;
  if song_ws is distinct from list_ws then
    raise exception 'Song and setlist are in different workspaces';
  end if;
  return new;
end $$;

drop trigger if exists zz_ws_check_pair on public.setlist_songs;
create trigger zz_ws_check_pair before insert or update of song_id, setlist_id on public.setlist_songs
  for each row execute function public.check_setlist_song_workspace();

-- Free-text columns the app treats as enums. NOT VALID = enforced for new writes, existing rows not re-checked.
alter table public.shows drop constraint if exists shows_booking_status_check;
alter table public.shows add constraint shows_booking_status_check
  check (booking_status is null or booking_status in ('Inquiry', 'Quotation Shared', 'Confirmed', 'Advance Received', 'Completed')) not valid;

commit;
