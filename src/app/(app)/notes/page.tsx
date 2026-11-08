import { getCachedPersonalNotes, getCachedNotes, getCachedChecklistItems, getCachedAllProfiles, getCachedShows, getCachedSongs, getCachedUser } from '@/lib/data'
import { sectionGuard } from '@/lib/section-guard'
import { getWorkspaceContext } from '@/lib/workspace'
import { todayISO } from '@/lib/shows'
import { addDays, format } from 'date-fns'
import { ScopeToggle } from '@/components/layout/ScopeToggle'
import { PersonalNotes } from '@/components/notes/PersonalNotes'
import { createClient } from '@/lib/supabase/server'
import { purgeOldTrash } from '@/lib/notes-trash'
import { NotesList } from '@/components/notes/NotesList'
import { PageHeader } from '@/components/ui/PageHeader'
import type { ChecklistItem } from '@/types'

interface Props {
  searchParams: Promise<{ open?: string; new?: string; show?: string; song?: string; scope?: string }>
}

export default async function NotesPage({ searchParams }: Props) {
  const denied = await sectionGuard('notes')
  if (denied) return denied
  const { open, new: isNew, show, song, scope } = await searchParams

  // Your Personal space opens on notes assigned to you in every workspace, unless you pick "This one" or are opening a specific note.
  const wsCtx = await getWorkspaceContext()
  if (wsCtx?.current.workspace.type === 'personal' && wsCtx.memberships.length > 1 && scope !== 'this' && !open && !isNew && !show && !song) {
    const today = todayISO()
    return (
      <div className="max-w-3xl">
        <PageHeader title="Notes" subtitle="Assigned to you, across all your workspaces" action={<ScopeToggle all thisHref="/notes?scope=this" allHref="/notes" />} />
        <PersonalNotes notes={await getCachedPersonalNotes()} currentId={wsCtx.current.workspace.id} today={today} weekAhead={format(addDays(new Date(today + 'T00:00:00'), 7), 'yyyy-MM-dd')} />
      </div>
    )
  }

  // Trash older than 30 days is removed whenever someone opens Notes.
  const supabase = await createClient()
  await purgeOldTrash(supabase)

  const [notes, checklistItems, profiles, shows, songs, { data: { user } }] = await Promise.all([
    getCachedNotes(),
    getCachedChecklistItems(),
    getCachedAllProfiles(),
    getCachedShows(),
    getCachedSongs(),
    getCachedUser(),
  ])

  const nameOf = (id: string) =>
    id === user?.id ? 'You' : (profiles.find(p => p.id === id)?.display_name ?? 'Member')

  const checklistByNote: Record<string, ChecklistItem[]> = {}
  for (const item of checklistItems) {
    (checklistByNote[item.note_id] ??= []).push(item)
  }

  const authorLines: Record<string, string> = {}
  for (const note of notes) {
    authorLines[note.id] =
      `${note.updated_by ? `Edited by ${nameOf(note.updated_by)}` : `Added by ${nameOf(note.created_by)}`}` +
      ` · ${new Date(note.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Asia/Kolkata' })}`
  }

  const links = {
    shows: shows.map(s => ({ id: s.id, title: s.title, date: s.show_date })),
    songs: songs.map(s => ({ id: s.id, title: s.title })),
  }
  const liveCount = notes.filter(n => !n.deleted_at).length

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Notes"
        subtitle={`${liveCount} note${liveCount === 1 ? '' : 's'}. New notes are private to you until you share them.`}
      />
      <NotesList
        notes={notes}
        checklistByNote={checklistByNote}
        authorLines={authorLines}
        links={links}
        currentUserId={user?.id}
        openNoteId={open}
        composePrefill={isNew ? { showId: show, songId: song } : undefined}
      />
    </div>
  )
}
