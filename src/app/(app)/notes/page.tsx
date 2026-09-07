import { StickyNote } from 'lucide-react'
import { getCachedNotes, getCachedAllProfiles, getCachedUser } from '@/lib/data'
import { NoteModal } from '@/components/notes/NoteModal'
import { DeleteNoteButton } from '@/components/notes/DeleteNoteButton'

export default async function NotesPage() {
  const [notes, profiles, { data: { user } }] = await Promise.all([
    getCachedNotes(),
    getCachedAllProfiles(),
    getCachedUser(),
  ])

  const nameOf = (id: string) =>
    id === user?.id ? 'You' : (profiles.find(p => p.id === id)?.display_name ?? 'Band member')

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notes</h1>
          <p className="mt-1 text-sm text-gray-500">{notes.length} note{notes.length !== 1 ? 's' : ''} — a shared board for the band</p>
        </div>
        <NoteModal />
      </div>

      {!notes.length ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-gray-200 py-20 text-center">
          <StickyNote className="h-12 w-12 text-gray-300" />
          <div>
            <p className="font-medium text-gray-500">No notes yet</p>
            <p className="text-sm text-gray-400">Ideas, todos, reminders — anything the band should keep track of</p>
          </div>
          <NoteModal />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {notes.map(note => (
            <div key={note.id} className="group flex flex-col rounded-xl border border-brand-200 bg-white p-4 shadow-sm">
              <div className="mb-1 flex items-start justify-between gap-2">
                <p className="font-semibold text-gray-900">{note.title}</p>
                <div className="flex shrink-0 items-center gap-2">
                  <NoteModal note={note} />
                  <DeleteNoteButton id={note.id} />
                </div>
              </div>
              {note.content && <p className="mb-3 flex-1 whitespace-pre-wrap text-sm text-gray-600">{note.content}</p>}
              <p className="mt-auto text-xs text-gray-400">
                {note.updated_by ? `Last edited by ${nameOf(note.updated_by)}` : `Added by ${nameOf(note.created_by)}`}
                {' · '}
                {new Date(note.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
