import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceContext } from '@/lib/workspace'
import type { TaskData } from '@/types/tasks'
import { seesFrom, type GroupNote, type WorkspaceGroup } from '@/lib/groups'
import { toAccount, type FinanceAccount } from '@/lib/finance/accounts'
import { normaliseFinanceSettings } from '@/lib/finance/settings'
import { balancesByWorkspace } from '@/lib/finance/overview'

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

// One row per song-in-a-setlist for the current workspace: counts per setlist, and how many
// setlists each song is in.
export const getCachedSetlistSongCounts = cache(() =>
  inWorkspace((supabase, ws) => supabase.from('setlist_songs').select('setlist_id, song_id').eq('workspace_id', ws))
)

// Every setlist's songs in order with the bits the Setlists list previews — counts come from the same rows.
export const getCachedSetlistPreviewRows = cache(() =>
  inWorkspace((supabase, ws) =>
    supabase.from('setlist_songs').select('setlist_id, position, song:songs(id, title, artist, song_key)').eq('workspace_id', ws).order('position')
  )
)

export const getCachedSong = cache(async (id: string) => {
  const supabase = await createClient()
  const { data } = await supabase.from('songs').select('*').eq('id', id).single()
  return data
})

// One song's references (Spotify, YouTube, ...), in the order they were added.
export const getCachedSongReferences = cache(async (songId: string) => {
  const supabase = await createClient()
  const { data } = await supabase.from('song_references').select('*').eq('song_id', songId).order('position')
  return data ?? []
})

// Every reference in the workspace, light columns only: the song list's play buttons and setlist rehearsal.
export const getCachedReferenceRows = cache(() =>
  inWorkspace((supabase, ws) =>
    supabase.from('song_references').select('id, song_id, source, url, external_id, label, title, artist, thumbnail_url, moments').eq('workspace_id', ws).order('position')
  )
)

// The workspace's accounts (band account, cash box...), archived ones included; callers filter.
export const getCachedFinanceAccounts = cache(async (): Promise<FinanceAccount[]> => {
  const ctx = await getWorkspaceContext()
  if (!ctx) return []
  const supabase = await createClient()
  const { data } = await supabase.from('finance_accounts').select('*').eq('workspace_id', ctx.current.workspace.id).order('position').order('created_at')
  return (data ?? []).map(toAccount)
})

// The workspace's groups, each with who's in it. Members who have left are dropped by the database.
export const getCachedWorkspaceGroups = cache(async (): Promise<WorkspaceGroup[]> => {
  const ctx = await getWorkspaceContext()
  if (!ctx) return []
  const supabase = await createClient()
  const ws = ctx.current.workspace.id
  const [{ data: groups }, { data: members }] = await Promise.all([
    supabase.from('workspace_groups').select('id, name, color, sees').eq('workspace_id', ws).order('position').order('created_at'),
    supabase.from('workspace_group_members').select('group_id, user_id').eq('workspace_id', ws),
  ])
  return (groups ?? []).map(g => ({
    id: g.id, name: g.name, color: g.color, sees: seesFrom(g.sees),
    memberIds: (members ?? []).filter(m => m.group_id === g.id).map(m => m.user_id),
  }))
})

// Each group's notes on one song, keyed by group id.
export const getCachedSongGroupNotes = cache(async (songId: string): Promise<Record<string, GroupNote>> => {
  const supabase = await createClient()
  const { data } = await supabase.from('song_group_notes').select('group_id, content, updated_by, updated_at').eq('song_id', songId)
  return Object.fromEntries((data ?? []).map(n => [n.group_id, { content: n.content, updatedBy: n.updated_by, updatedAt: n.updated_at }]))
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
  const ctx = await getWorkspaceContext()
  if (!ctx) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('note_checklist_items')
    .select('*, note:notes!inner(workspace_id)')
    .eq('note.workspace_id', ctx.current.workspace.id)
    .order('position')
  return data ?? []
})

// Everything the Tasks pages show for the current workspace, fetched in one parallel batch
// and handled client-side (a workspace's task count is small). Labels live on the board row;
// assignees, label ids and the checklist live on the task row.
export const getCachedTaskData = cache(async (): Promise<TaskData> => {
  const empty: TaskData = { boards: [], buckets: [], tasks: [], fields: [] }
  const ctx = await getWorkspaceContext()
  if (!ctx) return empty
  const ws = ctx.current.workspace.id
  const supabase = await createClient()
  // Every open task, but only the most recent finished ones: a workspace's completed history
  // grows forever and nobody needs all of it on every page load.
  const [boards, buckets, openTasks, doneTasks, fields] = await Promise.all([
    supabase.from('task_boards').select('*').eq('workspace_id', ws).is('archived_at', null).order('created_at'),
    supabase.from('task_buckets').select('*').eq('workspace_id', ws).order('position'),
    supabase.from('tasks').select('*').eq('workspace_id', ws).neq('progress', 'completed').order('position'),
    supabase.from('tasks').select('*').eq('workspace_id', ws).eq('progress', 'completed').order('completed_at', { ascending: false, nullsFirst: false }).limit(150),
    // Empty until the custom columns SQL has been run.
    supabase.from('task_fields').select('*').eq('workspace_id', ws).order('position'),
  ])
  return {
    boards: boards.data ?? [],
    buckets: buckets.data ?? [],
    tasks: [...(openTasks.data ?? []), ...(doneTasks.data ?? [])],
    fields: fields.data ?? [],
  }
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
export const getCachedNotifications = cache(async (recipientId: string, limit?: number) => {
  const supabase = await createClient()
  const query = supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', recipientId)
    .order('created_at', { ascending: false })
  const { data } = await (limit ? query.limit(limit) : query)
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

// Busy blocks / details from the user's OTHER workspaces, already redacted in
// the database by each item's visibility (see calendar_external).
export const getCachedExternalCalendar = cache(async () => {
  const ctx = await getWorkspaceContext()
  if (!ctx) return []
  const supabase = await createClient()
  const { data } = await supabase.rpc('calendar_external', { p_ws: ctx.current.workspace.id })
  return data ?? []
})

// Every calendar source across ALL of the user's workspaces, for the read-only
// consolidated view. RLS already limits each table to workspaces they belong to.
export const getCachedAllCalendars = cache(async () => {
  const ctx = await getWorkspaceContext()
  if (!ctx) return null
  // Only workspaces where the calendar isn't hidden from you; shows and tasks also need their own section.
  const open = ctx.memberships.filter(m => m.sections.calendar !== 'none')
  const ids = open.map(m => m.workspace.id)
  const showIds = open.filter(m => m.sections.shows !== 'none').map(m => m.workspace.id)
  const taskIds = open.filter(m => m.sections.tasks !== 'none').map(m => m.workspace.id)
  const supabase = await createClient()
  const [shows, tasks, unavailability, events, profiles] = await Promise.all([
    supabase.from('shows').select('*').in('workspace_id', showIds),
    supabase.from('tasks').select('*').in('workspace_id', taskIds).not('due_date', 'is', null),
    supabase.from('unavailability').select('*').in('workspace_id', ids),
    supabase.from('calendar_events').select('*').in('workspace_id', ids),
    supabase.from('profiles').select('id, display_name'),
  ])
  return {
    shows: shows.data ?? [],
    tasks: tasks.data ?? [],
    unavailability: unavailability.data ?? [],
    events: events.data ?? [],
    profiles: profiles.data ?? [],
    workspaces: open.map(m => ({ id: m.workspace.id, name: m.workspace.type === 'personal' ? 'Personal' : m.workspace.name })),
  }
})

export interface PersonalTask { id: string; title: string; dueDate: string | null; priority: string; workspaceId: string; workspaceName: string; boardName: string }
export interface PersonalShow { id: string; title: string; date: string | null; venue: string | null; workspaceId: string; workspaceName: string }

const workspaceTitle = (m: { workspace: { type: string; name: string } }) => (m.workspace.type === 'personal' ? 'Personal' : m.workspace.name)

/** Open tasks assigned to you in every workspace where Tasks isn't hidden from you. */
export const getCachedPersonalTasks = cache(async (): Promise<PersonalTask[]> => {
  const ctx = await getWorkspaceContext()
  if (!ctx) return []
  const open = ctx.memberships.filter(m => m.sections.tasks !== 'none')
  if (open.length === 0) return []
  const ids = open.map(m => m.workspace.id)
  const supabase = await createClient()
  const [tasks, boards] = await Promise.all([
    supabase.from('tasks').select('id, title, due_date, priority, workspace_id, board_id').in('workspace_id', ids).contains('assignee_ids', [ctx.userId]).neq('progress', 'completed'),
    supabase.from('task_boards').select('id, name').in('workspace_id', ids).is('archived_at', null),
  ])
  const boardName = new Map((boards.data ?? []).map(b => [b.id, b.name]))
  const wsName = new Map(open.map(m => [m.workspace.id, workspaceTitle(m)]))
  return (tasks.data ?? [])
    .filter(t => boardName.has(t.board_id))
    .map(t => ({ id: t.id, title: t.title, dueDate: t.due_date, priority: t.priority, workspaceId: t.workspace_id, workspaceName: wsName.get(t.workspace_id) ?? '', boardName: boardName.get(t.board_id) ?? '' }))
})

/** Shows from every workspace where Shows isn't hidden from you. */
export const getCachedPersonalShows = cache(async (): Promise<PersonalShow[]> => {
  const ctx = await getWorkspaceContext()
  if (!ctx) return []
  const open = ctx.memberships.filter(m => m.sections.shows !== 'none')
  if (open.length === 0) return []
  const supabase = await createClient()
  const { data } = await supabase.from('shows').select('id, title, show_date, venue, workspace_id').in('workspace_id', open.map(m => m.workspace.id))
  const wsName = new Map(open.map(m => [m.workspace.id, workspaceTitle(m)]))
  return (data ?? []).flatMap(s => s.workspace_id ? [{ id: s.id, title: s.title, date: s.show_date, venue: s.venue, workspaceId: s.workspace_id, workspaceName: wsName.get(s.workspace_id) ?? '' }] : [])
})

export interface PersonalNote { id: string; title: string; dueDate: string | null; workspaceId: string; workspaceName: string }

/** Setlists from every workspace where Setlists isn't hidden from you (same shape as a show, so the list is shared). */
export const getCachedPersonalSetlists = cache(async (): Promise<PersonalShow[]> => {
  const ctx = await getWorkspaceContext()
  if (!ctx) return []
  const open = ctx.memberships.filter(m => m.sections.setlists !== 'none')
  if (open.length === 0) return []
  const supabase = await createClient()
  const { data } = await supabase.from('setlists').select('id, title, show_date, venue, workspace_id').in('workspace_id', open.map(m => m.workspace.id))
  const wsName = new Map(open.map(m => [m.workspace.id, workspaceTitle(m)]))
  return (data ?? []).flatMap(s => s.workspace_id ? [{ id: s.id, title: s.title, date: s.show_date, venue: s.venue, workspaceId: s.workspace_id, workspaceName: wsName.get(s.workspace_id) ?? '' }] : [])
})

/** Notes assigned to you, not done, not archived or in the trash, in every workspace where Notes isn't hidden from you. */
export const getCachedPersonalNotes = cache(async (): Promise<PersonalNote[]> => {
  const ctx = await getWorkspaceContext()
  if (!ctx) return []
  const open = ctx.memberships.filter(m => m.sections.notes !== 'none')
  if (open.length === 0) return []
  const supabase = await createClient()
  const { data } = await supabase.from('notes').select('id, title, due_date, workspace_id')
    .in('workspace_id', open.map(m => m.workspace.id)).eq('assigned_to', ctx.userId)
    .is('completed_at', null).is('archived_at', null).is('deleted_at', null)
  const wsName = new Map(open.map(m => [m.workspace.id, workspaceTitle(m)]))
  return (data ?? []).flatMap(n => n.workspace_id ? [{ id: n.id, title: n.title, dueDate: n.due_date, workspaceId: n.workspace_id, workspaceName: wsName.get(n.workspace_id) ?? '' }] : [])
})

export interface PersonalHolding { workspaceId: string; name: string; currency: string; balance: number }
export interface PersonalPayment {
  id: string
  workspaceName: string
  currency: string
  amount: number
  description: string
  /** Who it goes to (when you owe it) or who it comes from (when you're owed it). */
  otherName: string
}
export interface PersonalFinance { holdings: PersonalHolding[]; owe: PersonalPayment[]; owed: PersonalPayment[] }

/**
 * Your own money across every workspace you're in (Personal's finance overview): what you hold in each, and what you
 * owe or are owed. Only your own rows; other members' balances stay inside their workspace. Skips workspaces where
 * Finance is hidden from you.
 */
export const getCachedPersonalFinance = cache(async (): Promise<PersonalFinance | null> => {
  const ctx = await getWorkspaceContext()
  if (!ctx) return null
  const open = ctx.memberships.filter(m => m.workspace.type !== 'personal' && m.sections.finance !== 'none')
  if (open.length === 0) return { holdings: [], owe: [], owed: [] }
  const ids = open.map(m => m.workspace.id)
  const me = ctx.userId
  const supabase = await createClient()
  const [txns, payments, profiles] = await Promise.all([
    supabase.from('finance_transactions').select('workspace_id, amount, category').in('workspace_id', ids).eq('member_id', me),
    supabase.from('pending_payments').select('*').in('workspace_id', ids).is('paid_at', null).or(`from_member.eq.${me},to_member.eq.${me}`),
    supabase.from('profiles').select('id, display_name'),
  ])
  const accountIds = [...new Set((payments.data ?? []).map(p => p.from_account).filter((a): a is string => !!a))]
  const accounts = accountIds.length ? (await supabase.from('finance_accounts').select('id, name').in('id', accountIds)).data ?? [] : []

  const meta = Object.fromEntries(open.map(m => {
    const raw = m.workspace.settings && typeof m.workspace.settings === 'object' && !Array.isArray(m.workspace.settings) ? (m.workspace.settings as Record<string, unknown>).finance : undefined
    return [m.workspace.id, { name: m.workspace.name, currency: normaliseFinanceSettings(raw).currency }]
  }))
  const balances = balancesByWorkspace(txns.data ?? [])
  const nameOf = (id: string | null) => (profiles.data ?? []).find(p => p.id === id)?.display_name ?? 'A member'
  const toItem = (p: NonNullable<typeof payments.data>[number], other: string): PersonalPayment => ({
    id: p.id, workspaceName: meta[p.workspace_id ?? '']?.name ?? '', currency: meta[p.workspace_id ?? '']?.currency ?? 'INR', amount: p.amount, description: p.category === 'balance_reimbursement' ? 'Balance reimbursement' : p.description, otherName: other,
  })
  return {
    holdings: open.map(m => ({ workspaceId: m.workspace.id, name: m.workspace.name, currency: meta[m.workspace.id].currency, balance: balances[m.workspace.id] ?? 0 })),
    owe: (payments.data ?? []).filter(p => p.from_member === me).map(p => toItem(p, nameOf(p.to_member))),
    owed: (payments.data ?? []).filter(p => p.to_member === me).map(p => toItem(p, p.from_account ? (accounts.find(a => a.id === p.from_account)?.name ?? 'An account') : nameOf(p.from_member))),
  }
})

export interface WorkspaceAttention {
  memberCount: number
  nextShowDate: string | null
  tasksDue: number
}

// One round trip for every workspace the user belongs to: member count, next show and tasks
// due soon. Feeds the switcher badges and the workspaces overview.
export const getWorkspaceAttention = cache(async (): Promise<Record<string, WorkspaceAttention>> => {
  const supabase = await createClient()
  const { data } = await supabase.rpc('workspace_attention')
  return Object.fromEntries(
    (data ?? []).map(r => [r.workspace_id, { memberCount: r.member_count, nextShowDate: r.next_show_date, tasksDue: r.tasks_due }])
  )
})

// The current workspace's money settings, with every missing field filled from the defaults.
export const getCachedFinanceSettings = cache(async () => {
  const ctx = await getWorkspaceContext()
  const raw = ctx?.current.workspace.settings
  const finance = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>).finance : undefined
  return normaliseFinanceSettings(finance)
})

export const getCachedFinanceProjects = cache(() =>
  inWorkspace((supabase, ws) => supabase.from('finance_projects').select('*').eq('workspace_id', ws).order('created_at', { ascending: false }))
)

export const getCachedRecurring = cache(() =>
  inWorkspace((supabase, ws) => supabase.from('finance_recurring').select('*').eq('workspace_id', ws).order('created_at'))
)

// Photos for the people in the current workspace, by id. Kept apart from getCachedAllProfiles so a
// database without the avatar_url column yet just shows initials instead of breaking every list.
export const getCachedProfileAvatars = cache(async (): Promise<Record<string, string>> => {
  const profiles = await getCachedAllProfiles()
  const ctx = await getWorkspaceContext()
  const ids = [...new Set([...profiles.map(p => p.id), ...(ctx ? [ctx.userId] : [])])]
  if (!ids.length) return {}
  const supabase = await createClient()
  const { data, error } = await supabase.from('profiles').select('id, avatar_url').in('id', ids)
  if (error || !data) return {}
  return Object.fromEntries(data.filter(p => p.avatar_url).map(p => [p.id, p.avatar_url as string]))
})

export const getCachedFinanceRequests = cache(() =>
  inWorkspace((supabase, ws) => supabase.from('finance_requests').select('*').eq('workspace_id', ws).order('created_at', { ascending: false }))
)
