'use client'

import { useState, useTransition } from 'react'
import { Trash2, Pin, Archive, ArchiveRestore, Check, Repeat } from 'lucide-react'
import { NoteModal } from './NoteModal'
import { deleteNote, toggleNoteComplete, toggleChecklistItem, togglePin, toggleArchive } from '@/actions/notes'
import { useToast } from '@/components/ui/Toaster'
import { cn } from '@/lib/utils'
import { countdownLabel } from '@/lib/dates'
import { linkifyText } from '@/lib/linkify'
import { NOTE_COLOR_CLASSES, RECURRENCE_LABELS, type NoteColor, type Recurrence } from '@/types/notes'
import type { Note, ChecklistItem } from '@/types'

interface Member { id: string; name: string }

interface Props {
  note: Note
  checklistItems: ChecklistItem[]
  members: Member[]
  /** Already resolved to a display string — never pass a function here, it can't cross the server/client boundary. */
  authorLine: string
  assigneeName: string | null
  /** profile id -> display name, for resolving each checklist item's own assignee (a plain lookup object, not a function). */
  memberNameById: Record<string, string>
  /** Today's date (YYYY-MM-DD), server-computed for consistent overdue/countdown rendering. */
  today: string
}

/**
 * A whole note card that opens Edit on tap — no hunting for a tiny pencil
 * icon that only ever showed up on :hover, which never fires on a
 * touchscreen. Delete/pin/archive/complete stay real, always-visible
 * buttons of their own (stopping the tap from also opening Edit), with a
 * confirm before delete since it's no longer hover-gated as an accidental
 * safety net. Checklist items are independently tappable too, without
 * opening the edit modal at all.
 */
export function NoteCard({ note, checklistItems, members, authorLine, assigneeName, memberNameById, today }: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [isDeleting, startDeleteTransition] = useTransition()
  const [, startTransition] = useTransition()
  const toast = useToast()

  const isTask = !!note.due_date || !!note.assigned_to
  const isDone = !!note.completed_at
  const doneCount = checklistItems.filter(i => i.done).length

  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  const handleDelete = (e: React.MouseEvent) => {
    stop(e)
    if (!window.confirm('Delete this? This can’t be undone.')) return
    startDeleteTransition(async () => {
      const result = await deleteNote(note.id)
      if (result.error) toast(result.error, 'error')
    })
  }

  const handleComplete = (e: React.MouseEvent) => {
    stop(e)
    startTransition(async () => {
      const result = await toggleNoteComplete(note.id, !isDone)
      if (result.error) toast(result.error, 'error')
      else if (!isDone && note.recurrence) toast(`Done — next one's due ${RECURRENCE_LABELS[note.recurrence as Recurrence].toLowerCase()}`, 'success')
    })
  }

  const handlePin = (e: React.MouseEvent) => {
    stop(e)
    startTransition(() => { togglePin(note.id, !note.pinned) })
  }

  const handleArchive = (e: React.MouseEvent) => {
    stop(e)
    startTransition(() => { toggleArchive(note.id, !note.archived_at) })
  }

  const handleChecklistToggle = (e: React.MouseEvent, item: ChecklistItem) => {
    stop(e)
    startTransition(() => { toggleChecklistItem(item.id, !item.done) })
  }

  const colorClasses = note.color && note.color in NOTE_COLOR_CLASSES ? NOTE_COLOR_CLASSES[note.color as NoteColor] : 'bg-white border-brand-200'
  const days = note.due_date ? countdownLabel(note.due_date, today) : null
  const overdue = !!note.due_date && !isDone && note.due_date < today

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setEditOpen(true)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditOpen(true) } }}
      className={cn(
        // min-w-0 overrides the grid item's default min-width:auto — without
        // it, one long unbroken token (a URL with no spaces, say) forces the
        // whole grid column wider than the viewport instead of wrapping.
        'flex min-w-0 cursor-pointer flex-col gap-2 rounded-xl border p-4 text-left shadow-sm transition-colors hover:border-brand-400',
        colorClasses,
        isDone && 'opacity-60'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {isTask && (
            <button
              type="button"
              onClick={handleComplete}
              aria-label={isDone ? 'Mark not done' : 'Mark done'}
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                isDone ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300 hover:border-emerald-400'
              )}
            >
              {isDone && <Check className="h-3 w-3" />}
            </button>
          )}
          <p className={cn('min-w-0 flex-1 break-words font-semibold text-gray-900', isDone && 'line-through')}>{note.title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={handlePin} aria-label={note.pinned ? 'Unpin' : 'Pin'}
            className={cn('rounded-md p-1.5 transition-colors hover:bg-black/5', note.pinned ? 'text-amber-500' : 'text-gray-300')}>
            <Pin className={cn('h-4 w-4', note.pinned && 'fill-current')} />
          </button>
          <button type="button" onClick={handleArchive} aria-label={note.archived_at ? 'Unarchive' : 'Archive'} className="rounded-md p-1.5 text-gray-300 transition-colors hover:bg-black/5 hover:text-gray-500">
            {note.archived_at ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          </button>
          <button type="button" onClick={handleDelete} disabled={isDeleting} aria-label="Delete"
            className="rounded-md p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {note.content && (
        <p className="whitespace-pre-wrap break-words text-sm text-gray-600">{linkifyText(note.content)}</p>
      )}

      {checklistItems.length > 0 && (
        <div className="space-y-1">
          {checklistItems.map(item => (
            <div key={item.id} onClick={e => handleChecklistToggle(e, item)} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-black/5">
              <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border-2', item.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300')}>
                {item.done && <Check className="h-2.5 w-2.5" />}
              </span>
              <span className={cn('min-w-0 flex-1 truncate text-sm text-gray-700', item.done && 'text-gray-400 line-through')}>{item.text}</span>
              {item.assigned_to && memberNameById[item.assigned_to] && (
                <span className="shrink-0 rounded-full bg-violet-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-600">
                  {memberNameById[item.assigned_to]}
                </span>
              )}
            </div>
          ))}
          <p className="pl-6 text-xs text-gray-400">{doneCount}/{checklistItems.length} done</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {days && (
          <span className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
            overdue ? 'bg-red-100 text-red-700' : isDone ? 'bg-gray-100 text-gray-500' : 'bg-brand-100 text-brand-700')}>
            {days}
          </span>
        )}
        {note.recurrence && (
          <span className="flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
            <Repeat className="h-2.5 w-2.5" />{RECURRENCE_LABELS[note.recurrence as Recurrence]}
          </span>
        )}
        {assigneeName && (
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">{assigneeName}</span>
        )}
        {(note.labels ?? []).map(label => (
          <span key={label} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">{label}</span>
        ))}
      </div>

      <p className="mt-auto text-xs text-gray-400">{authorLine}</p>

      {/* React portals still bubble clicks up the *React* tree (Radix's
          dialog included), not just the DOM tree — without this stopgap, a
          tap on "Cancel" or "Save" inside the modal would also re-fire the
          card's own onClick right after, immediately reopening it. */}
      <div onClick={stop}>
        <NoteModal note={note} checklistItems={checklistItems} members={members} open={editOpen} onOpenChange={setEditOpen} />
      </div>
    </div>
  )
}
