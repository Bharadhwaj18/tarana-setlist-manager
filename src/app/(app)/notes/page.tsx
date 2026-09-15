import { StickyNote } from 'lucide-react'
import { getCachedNotes, getCachedChecklistItems, getCachedAllProfiles, getCachedUser } from '@/lib/data'
import { todayISO } from '@/lib/shows'
import { NoteModal } from '@/components/notes/NoteModal'
import { NotesList } from '@/components/notes/NotesList'
import type { ChecklistItem } from '@/types'

export default async function NotesPage() {
  const [notes, checklistItems, profiles, { data: { user } }] = await Promise.all([
    getCachedNotes(),
    getCachedChecklistItems(),
    getCachedAllProfiles(),
    getCachedUser(),
  ])

  const nameOf = (id: string) =>
    id === user?.id ? 'You' : (profiles.find(p => p.id === id)?.display_name ?? 'Band member')

  const members = profiles.map(p => ({ id: p.id, name: p.id === user?.id ? 'You' : (p.display_name ?? 'Band member') }))

  const checklistByNote: Record<string, ChecklistItem[]> = {}
  for (const item of checklistItems) {
    (checklistByNote[item.note_id] ??= []).push(item)
  }

  // Sender/assignee names resolved server-side into plain strings, keyed
  // by note id — never pass a resolver function to the client NotesList.
  const authorLines: Record<string, string> = {}
  const assigneeNames: Record<string, string | null> = {}
  for (const note of notes) {
    authorLines[note.id] =
      `${note.updated_by ? `Last edited by ${nameOf(note.updated_by)}` : `Added by ${nameOf(note.created_by)}`}` +
      ` · ${new Date(note.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Asia/Kolkata' })}`
    assigneeNames[note.id] = note.assigned_to ? nameOf(note.assigned_to) : null
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notes</h1>
          <p className="mt-1 text-sm text-gray-500">{notes.length} note{notes.length !== 1 ? 's' : ''} — a shared board for the band</p>
        </div>
        <NoteModal members={members} />
      </div>

      {!notes.length ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-gray-200 py-20 text-center">
          <StickyNote className="h-12 w-12 text-gray-300" />
          <div>
            <p className="font-medium text-gray-500">No notes yet</p>
            <p className="text-sm text-gray-400">Ideas, todos, reminders — anything the band should keep track of</p>
          </div>
          <NoteModal members={members} />
        </div>
      ) : (
        <NotesList
          notes={notes}
          checklistByNote={checklistByNote}
          members={members}
          currentUserId={user?.id ?? ''}
          authorLines={authorLines}
          assigneeNames={assigneeNames}
          today={todayISO()}
        />
      )}
    </div>
  )
}
