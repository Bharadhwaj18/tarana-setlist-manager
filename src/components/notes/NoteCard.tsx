'use client'

import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { NoteModal } from './NoteModal'
import { deleteNote } from '@/actions/notes'
import { useToast } from '@/components/ui/Toaster'
import type { Note } from '@/types'

interface Props {
  note: Note
  /** Already resolved to a display string — never pass a function here, it can't cross the server/client boundary. */
  authorLine: string
}

/**
 * A whole note card that opens Edit on tap — no hunting for a tiny pencil
 * icon that only ever showed up on :hover, which never fires on a
 * touchscreen. Delete stays a real, always-visible button of its own
 * (stopping the tap from also opening Edit), with a confirm before it
 * actually deletes anything, since it's no longer hover-gated as an
 * accidental safety net.
 */
export function NoteCard({ note, authorLine }: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [isDeleting, startDeleteTransition] = useTransition()
  const toast = useToast()

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm('Delete this note? This can’t be undone.')) return
    startDeleteTransition(async () => {
      const result = await deleteNote(note.id)
      if (result.error) toast(result.error, 'error')
    })
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setEditOpen(true)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setEditOpen(true)
        }
      }}
      className="flex cursor-pointer flex-col rounded-xl border border-brand-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-brand-400"
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 break-words font-semibold text-gray-900">{note.title}</p>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          aria-label="Delete note"
          className="shrink-0 rounded-md p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {note.content && (
        <p className="mb-3 flex-1 whitespace-pre-wrap break-words text-sm text-gray-600">{note.content}</p>
      )}
      <p className="mt-auto text-xs text-gray-400">{authorLine}</p>

      {/* React portals still bubble clicks up the *React* tree (Radix's
          dialog included), not just the DOM tree — without this stopgap, a
          tap on "Cancel" or "Save" inside the modal would also re-fire the
          card's own onClick right after, immediately reopening it. */}
      <div onClick={e => e.stopPropagation()}>
        <NoteModal note={note} open={editOpen} onOpenChange={setEditOpen} />
      </div>
    </div>
  )
}
