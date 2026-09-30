-- Indexes for the hot read paths. Safe to re-run; tables are small so a plain (locking) create is fine.
-- workspace_id single-column indexes already exist (phase 1); these add the composite / foreign-key ones.

create index if not exists shows_ws_date_idx on public.shows (workspace_id, show_date);
create index if not exists calendar_events_ws_start_idx on public.calendar_events (workspace_id, start_date);
create index if not exists unavailability_ws_start_idx on public.unavailability (workspace_id, start_date);
create index if not exists finance_transactions_ws_date_idx on public.finance_transactions (workspace_id, date desc);
create index if not exists finance_transactions_show_idx on public.finance_transactions (show_id) where show_id is not null;
create index if not exists pending_payments_ws_to_idx on public.pending_payments (workspace_id, to_member);
create index if not exists pending_payments_show_idx on public.pending_payments (show_id) where show_id is not null;
create index if not exists setlists_show_idx on public.setlists (show_id) where show_id is not null;
create index if not exists setlist_songs_setlist_idx on public.setlist_songs (setlist_id, position);
create index if not exists setlist_songs_song_idx on public.setlist_songs (song_id);
create index if not exists note_checklist_items_note_idx on public.note_checklist_items (note_id);
create index if not exists notes_ws_due_idx on public.notes (workspace_id, due_date) where due_date is not null;
create index if not exists notifications_recipient_created_idx on public.notifications (recipient_id, created_at desc);
create index if not exists push_subscriptions_profile_idx on public.push_subscriptions (profile_id);
create index if not exists budget_adjustments_budget_idx on public.budget_adjustments (budget_id);
