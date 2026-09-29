import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceContext } from '@/lib/workspace'

export { getCachedUser } from '@/lib/auth-cache'

// Every list below is scoped to the user's currently selected workspace. With
// no resolvable workspace (signed out, or offline where the auth check can't
// run) a list is simply empty — same as an offline query returned before.
async function inWorkspace<T>(run: (supabase: Awaited<ReturnType<typeof createClient>>, workspaceId: string) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const ctx = await getWorkspaceContext()
  if (!ctx) return []
  const supabase = await createClient()
  const { data } = await run(supabase, ctx.current.workspace.id)
  return data ?? []
}

export const getCachedSongs = cache(() =>
  inWorkspace((supabase, ws) => supabase.from('songs').select('*').eq('workspace_id', ws).order('title'))
)

export const getCachedSetlists = cache(() =>
  inWorkspace((supabase, ws) =>
    supabase.from('setlists').select('*').eq('workspace_id', ws).order('show_date', { ascending: false, nullsFirst: false })
  )
)

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

// Members of the current workspace — the people a band's pickers, finance
// balances and 'recorded by' names should ever list.
export const getCachedAllProfiles = cache(async () => {
  const ctx = await getWorkspaceContext()
  if (!ctx) return []
  const supabase = await createClient()
  const { data: members } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', ctx.current.workspace.id)
  const ids = (members ?? []).map(m => m.user_id)
  if (!ids.length) return []
  const { data } = await supabase.from('profiles').select('id, display_name').in('id', ids)
  return data ?? []
})

export const getCachedShows = cache(() =>
  inWorkspace((supabase, ws) =>
    supabase.from('shows').select('*').eq('workspace_id', ws).order('show_date', { ascending: false, nullsFirst: false })
  )
)

export const getCachedShow = cache(async (id: string) => {
  const supabase = await createClient()
  const { data } = await supabase.from('shows').select('*').eq('id', id).single()
  return data
})

// Every show's own finance transactions and linked setlist, keyed by
// show id — the Shows list/detail pages pull both in one shot rather than
// a query per show.
export const getCachedShowTransactions = cache(() =>
  inWorkspace((supabase, ws) => supabase.from('finance_transactions').select('*').eq('workspace_id', ws).not('show_id', 'is', null))
)

export const getCachedSetlistsByShow = cache(() =>
  inWorkspace((supabase, ws) => supabase.from('setlists').select('id, title, show_id').eq('workspace_id', ws).not('show_id', 'is', null))
)

export const getCachedEventManagementCompanies = cache(() =>
  inWorkspace((supabase, ws) => supabase.from('event_management').select('*').eq('workspace_id', ws).order('name'))
)

export const getCachedEventManagementCompany = cache(async (id: string) => {
  const supabase = await createClient()
  const { data } = await supabase.from('event_management').select('*').eq('id', id).single()
  return data
})

export const getCachedNotes = cache(() =>
  inWorkspace((supabase, ws) => supabase.from('notes').select('*').eq('workspace_id', ws).order('updated_at', { ascending: false }))
)

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
export const getCachedPendingPayments = cache(() =>
  inWorkspace((supabase, ws) =>
    supabase.from('pending_payments').select('*').eq('workspace_id', ws).is('paid_at', null).order('created_at', { ascending: false })
  )
)

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
export const getCachedUnavailability = cache(() =>
  inWorkspace((supabase, ws) => supabase.from('unavailability').select('*').eq('workspace_id', ws).order('start_date'))
)

// Freeform calendar entries — same "fetch all, filter client-side" pattern
// as unavailability, small table.
export const getCachedCalendarEvents = cache(() =>
  inWorkspace((supabase, ws) => supabase.from('calendar_events').select('*').eq('workspace_id', ws).order('start_date'))
)

// Voice memos, newest first, with the tagged song's title joined in (if
// any) for the list's optional tag badge — same join pattern as
// getCachedSetlistSongs.
export const getCachedRecordings = cache(() =>
  inWorkspace((supabase, ws) =>
    supabase.from('recordings').select('*, song:songs(id, title)').eq('workspace_id', ws).order('created_at', { ascending: false })
  )
)
