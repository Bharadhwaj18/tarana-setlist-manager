import { StickyNote } from 'lucide-react'
import { getCachedNotes, getCachedChecklistItems, getCachedAllProfiles, getCachedUser } from '@/lib/data'
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
    id === user?.id ? 'You' : (profiles.find(p => p.id === id)?.display_name ?? 'Member')

  const checklistByNote: Record<string, ChecklistItem[]> = {}
  for (const item of checklistItems) {
    (checklistByNote[item.note_id] ??= []).push(item)
  }

  // Names resolved server-side into plain strings, keyed by note id.
  const authorLines: Record<string, string> = {}
  for (const note of notes) {
    authorLines[note.id] =
      `${note.updated_by ? `Edited by ${nameOf(note.updated_by)}` : `Added by ${nameOf(note.created_by)}`}` +
      ` · ${new Date(note.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Asia/Kolkata' })}`
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notes</h1>
          <p className="mt-1 text-sm text-gray-500">{notes.length} note{notes.length !== 1 ? 's' : ''} — shared with everyone in the workspace</p>
        </div>
        <NoteModal />
      </div>

      {!notes.length ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-gray-200 py-20 text-center">
          <StickyNote className="h-12 w-12 text-gray-300" />
          <div>
            <p className="font-medium text-gray-500">No notes yet</p>
            <p className="text-sm text-gray-400">Ideas, lists, anything worth jotting down. For work you assign to people, use Tasks.</p>
          </div>
          <NoteModal />
        </div>
      ) : (
        <NotesList notes={notes} checklistByNote={checklistByNote} authorLines={authorLines} />
      )}
    </div>
  )
}
