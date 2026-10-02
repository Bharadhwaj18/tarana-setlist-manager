'use client'

import { useState, useTransition } from 'react'
import { Trash2, Pin, Archive, ArchiveRestore, Check } from 'lucide-react'
import { NoteModal } from './NoteModal'
import { deleteNote, toggleChecklistItem, togglePin, toggleArchive } from '@/actions/notes'
import { useToast } from '@/components/ui/Toaster'
import { cn } from '@/lib/utils'
import { linkifyText } from '@/lib/linkify'
import { NOTE_COLOR_CLASSES, type NoteColor } from '@/types/notes'
import type { Note, ChecklistItem } from '@/types'

interface Props {
  note: Note
  checklistItems: ChecklistItem[]
  /** Already resolved to a display string — never pass a function across the server/client boundary. */
  authorLine: string
}

const MAX_PREVIEW_ITEMS = 8

/**
 * The whole card opens Edit on tap (hover-only controls never fire on a touchscreen). Pin,
 * archive and delete are always-visible buttons that stop the tap from also opening Edit.
 */
export function NoteCard({ note, checklistItems, authorLine }: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [isDeleting, startDeleteTransition] = useTransition()
  const [, startTransition] = useTransition()
  const toast = useToast()

  const stop = (e: React.SyntheticEvent) => e.stopPropagation()
  const shownItems = checklistItems.slice(0, MAX_PREVIEW_ITEMS)
  const hiddenCount = checklistItems.length - shownItems.length

  const handleDelete = (e: React.MouseEvent) => {
    stop(e)
    if (!window.confirm('Delete this note? This can’t be undone.')) return
    startDeleteTransition(async () => {
      const result = await deleteNote(note.id)
      if (result.error) toast(result.error, 'error')
    })
  }

  const colorClasses = note.color && note.color in NOTE_COLOR_CLASSES ? NOTE_COLOR_CLASSES[note.color as NoteColor] : 'bg-white border-brand-200'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setEditOpen(true)}
      onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setEditOpen(true) } }}
      className={cn('flex min-w-0 cursor-pointer flex-col gap-2 rounded-xl border p-4 text-left shadow-sm transition-colors hover:border-brand-400', colorClasses)}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 break-words font-semibold text-gray-900">{note.title}</p>
        <button type="button" onClick={e => { stop(e); startTransition(() => { togglePin(note.id, !note.pinned) }) }} aria-label={note.pinned ? 'Unpin' : 'Pin'}
          className={cn('shrink-0 rounded-md p-1.5 transition-colors hover:bg-black/5', note.pinned ? 'text-amber-500' : 'text-gray-300')}>
          <Pin className={cn('h-4 w-4', note.pinned && 'fill-current')} />
        </button>
      </div>

      {note.content && <p className="whitespace-pre-wrap break-words text-sm text-gray-600">{linkifyText(note.content)}</p>}

      {shownItems.length > 0 && (
        <div className="space-y-0.5">
          {shownItems.map(item => (
            <div
              key={item.id}
              onClick={e => { stop(e); startTransition(() => { toggleChecklistItem(item.id, !item.done) }) }}
              className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-black/5"
            >
              <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border-2', item.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300')}>
                {item.done && <Check className="h-2.5 w-2.5" />}
              </span>
              <span className={cn('min-w-0 flex-1 break-words text-sm text-gray-700', item.done && 'text-gray-400 line-through')}>{item.text}</span>
            </div>
          ))}
          {hiddenCount > 0 && <p className="pl-6 text-xs text-gray-400">+ {hiddenCount} more</p>}
        </div>
      )}

      {(note.labels ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {(note.labels ?? []).map(label => (
            <span key={label} className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-medium text-gray-600">{label}</span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs text-gray-400">{authorLine}</p>
        <div className="flex shrink-0 items-center">
          <button type="button" onClick={e => { stop(e); startTransition(() => { toggleArchive(note.id, !note.archived_at) }) }} aria-label={note.archived_at ? 'Unarchive' : 'Archive'}
            className="rounded-md p-1.5 text-gray-300 transition-colors hover:bg-black/5 hover:text-gray-500">
            {note.archived_at ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          </button>
          <button type="button" onClick={handleDelete} disabled={isDeleting} aria-label="Delete"
            className="rounded-md p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Portalled dialogs still bubble clicks up the React tree — stop them re-triggering the card. */}
      <div onClick={stop}>
        <NoteModal note={note} checklistItems={checklistItems} open={editOpen} onOpenChange={setEditOpen} />
      </div>
    </div>
  )
}
