import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

// getUser() makes a real network round-trip to Supabase's auth server to
// verify the token (unlike getSession(), which just reads the local JWT).
// Middleware, the (app) layout, and every page all call it — without this,
// that's 3+ separate round-trips for a single navigation. cache() collapses
// every call within one request/render pass into the one already in flight.
export const getCachedUser = cache(async () => {
  const supabase = await createClient()
  return supabase.auth.getUser()
})

export const getCachedSongs = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.from('songs').select('*').order('title')
  return data ?? []
})

export const getCachedSetlists = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('setlists')
    .select('*')
    .order('show_date', { ascending: false, nullsFirst: false })
  return data ?? []
})

export const getCachedSetlistSongCounts = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.from('setlist_songs').select('setlist_id')
  return data ?? []
})

export const getCachedSong = cache(async (id: string) => {
  const supabase = await createClient()
  const { data } = await supabase.from('songs').select('*').eq('id', id).single()
  return data
})

export const getCachedSetlist = cache(async (id: string) => {
  const supabase = await createClient()
  const { data } = await supabase.from('setlists').select('*').eq('id', id).single()
  return data
})

export const getCachedSetlistSongs = cache(async (setlistId: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('setlist_songs')
    .select('*, song:songs(*)')
    .eq('setlist_id', setlistId)
    .order('position')
  return data ?? []
})

export const getCachedAllProfiles = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select('id, display_name')
  return data ?? []
})

export const getCachedShows = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('shows')
    .select('*')
    .order('show_date', { ascending: false, nullsFirst: false })
  return data ?? []
})

export const getCachedShow = cache(async (id: string) => {
  const supabase = await createClient()
  const { data } = await supabase.from('shows').select('*').eq('id', id).single()
  return data
})

// Every show's own finance transactions and linked setlist, keyed by
// show id — the Shows list/detail pages pull both in one shot rather than
// a query per show.
export const getCachedShowTransactions = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.from('finance_transactions').select('*').not('show_id', 'is', null)
  return data ?? []
})

export const getCachedSetlistsByShow = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.from('setlists').select('id, title, show_id').not('show_id', 'is', null)
  return data ?? []
})

export const getCachedEventManagementCompanies = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.from('event_management').select('*').order('name')
  return data ?? []
})

export const getCachedEventManagementCompany = cache(async (id: string) => {
  const supabase = await createClient()
  const { data } = await supabase.from('event_management').select('*').eq('id', id).single()
  return data
})

export const getCachedNotes = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.from('notes').select('*').order('updated_at', { ascending: false })
  return data ?? []
})

// Every checklist item for every note in one query (grouped by note_id
// client-side) rather than one query per note — same "fetch all, group in
// JS" convention as getCachedShowTransactions.
export const getCachedChecklistItems = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.from('note_checklist_items').select('*').order('position')
  return data ?? []
})

// Every unpaid split payment still waiting on someone to actually hand the
// money over — the reminder banner (Finance page) and the Sidebar's badge
// both read this, plus Split History shows them alongside paid ones.
export const getCachedPendingPayments = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('pending_payments')
    .select('*')
    .is('paid_at', null)
    .order('created_at', { ascending: false })
  return data ?? []
})

// A profile's own notifications, newest first — reused for both the
// Sidebar bell's unread badge and the full inbox page.
export const getCachedNotifications = cache(async (recipientId: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', recipientId)
    .order('created_at', { ascending: false })
  return data ?? []
})

// Every member-unavailability range — small table, the Calendar just
// fetches all of it and filters client-side per visible month.
export const getCachedUnavailability = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.from('unavailability').select('*').order('start_date')
  return data ?? []
})

// Freeform calendar entries — same "fetch all, filter client-side" pattern
// as unavailability, small table.
export const getCachedCalendarEvents = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.from('calendar_events').select('*').order('start_date')
  return data ?? []
})

// Voice memos, newest first, with the tagged song's title joined in (if
// any) for the list's optional tag badge — same join pattern as
// getCachedSetlistSongs.
export const getCachedRecordings = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('recordings')
    .select('*, song:songs(id, title)')
    .order('created_at', { ascending: false })
  return data ?? []
})
