'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { NoteCard } from './NoteCard'
import type { Note, ChecklistItem } from '@/types'

interface Member { id: string; name: string }

interface Props {
  notes: Note[]
  checklistByNote: Record<string, ChecklistItem[]>
  members: Member[]
  currentUserId: string
  /** Pre-resolved server-side, keyed by note id — never pass a resolver function across the server/client boundary. */
  authorLines: Record<string, string>
  assigneeNames: Record<string, string | null>
  today: string
}

type Filter = 'all' | 'notes' | 'tasks' | 'mine' | 'pinned' | 'archived'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'notes', label: 'Notes' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'mine', label: 'Assigned to me' },
  { value: 'pinned', label: 'Pinned' },
  { value: 'archived', label: 'Archived' },
]

export function NotesList({ notes, checklistByNote, members, currentUserId, authorLines, assigneeNames, today }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [label, setLabel] = useState<string | null>(null)

  const allLabels = [...new Set(notes.flatMap(n => n.labels ?? []))].sort()

  const base = filter === 'archived' ? notes.filter(n => n.archived_at) : notes.filter(n => !n.archived_at)
  const filtered = base.filter(n => {
    if (filter === 'notes') return !n.due_date && !n.assigned_to
    if (filter === 'tasks') return !!n.due_date || !!n.assigned_to
    if (filter === 'mine') return n.assigned_to === currentUserId
    if (filter === 'pinned') return n.pinned
    return true
  }).filter(n => !label || (n.labels ?? []).includes(label))

  // Pinned first, then by most recently updated (already the incoming order).
  const sorted = [...filtered].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
              filter === f.value ? 'bg-brand-400 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {allLabels.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {allLabels.map(l => (
            <button
              key={l}
              onClick={() => setLabel(prev => prev === l ? null : l)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                label === l ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              )}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">Nothing here</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sorted.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              checklistItems={checklistByNote[note.id] ?? []}
              members={members}
              authorLine={authorLines[note.id] ?? ''}
              assigneeName={assigneeNames[note.id] ?? null}
              today={today}
            />
          ))}
        </div>
      )}
    </div>
  )
}
