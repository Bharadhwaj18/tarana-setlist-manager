'use client'

import { useMemo, useState, useTransition } from 'react'
import { Search, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { emptyTrash } from '@/actions/notes'
import { useToast } from '@/components/ui/Toaster'
import { Chip } from '@/components/ui/Chip'
import { NoteCard } from './NoteCard'
import { NoteComposer } from './NoteComposer'
import type { LinkTargets } from './NoteForm'
import type { Note, ChecklistItem } from '@/types'

interface Props {
  notes: Note[]
  checklistByNote: Record<string, ChecklistItem[]>
  /** Pre-resolved server-side, keyed by note id. */
  authorLines: Record<string, string>
  links: LinkTargets
  currentUserId?: string
  openNoteId?: string
  composePrefill?: { showId?: string; songId?: string }
}

type Filter = 'all' | 'private' | 'shared' | 'archived' | 'trash'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'private', label: 'Only me' },
  { value: 'shared', label: 'Workspace' },
  { value: 'archived', label: 'Archive' },
  { value: 'trash', label: 'Trash' },
]

export function NotesList({ notes, checklistByNote, authorLines, links, currentUserId, openNoteId, composePrefill }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [label, setLabel] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [, startTransition] = useTransition()
  const toast = useToast()

  const live = useMemo(() => notes.filter(n => !n.deleted_at), [notes])
  const allLabels = useMemo(() => [...new Set(live.flatMap(n => n.labels ?? []))].sort(), [live])
  const trashed = useMemo(() => notes.filter(n => n.deleted_at), [notes])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = filter === 'trash' ? trashed : filter === 'archived' ? live.filter(n => n.archived_at) : live.filter(n => !n.archived_at)
    return base
      .filter(n => filter !== 'private' || n.visibility === 'private')
      .filter(n => filter !== 'shared' || n.visibility === 'shared')
      .filter(n => !label || (n.labels ?? []).includes(label))
      .filter(n => {
        if (!q) return true
        const haystack = [n.title, n.content ?? '', ...(n.labels ?? []), ...(checklistByNote[n.id] ?? []).map(i => i.text)].join(' ').toLowerCase()
        return haystack.includes(q)
      })
  }, [live, trashed, filter, label, query, checklistByNote])

  const inTrash = filter === 'trash'
  const showPinnedSplit = !inTrash && filter !== 'archived'
  const pinned = showPinnedSplit ? filtered.filter(n => n.pinned) : []
  const rest = showPinnedSplit ? filtered.filter(n => !n.pinned) : filtered

  const grid = (list: Note[]) => (
    <div className="columns-1 gap-3 sm:columns-2 lg:columns-3">
      {list.map(note => (
        <div key={note.id} className="mb-3 break-inside-avoid">
          <NoteCard
            note={note}
            checklistItems={checklistByNote[note.id] ?? []}
            authorLine={authorLines[note.id] ?? ''}
            links={links}
            isMine={note.created_by === currentUserId}
            inTrash={inTrash}
            startOpen={note.id === openNoteId}
          />
        </div>
      ))}
    </div>
  )

  const sectionLabel = 'mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-gray-400'

  return (
    <div>
      {!inTrash && filter !== 'archived' && <NoteComposer links={links} prefill={composePrefill} startOpen={!!composePrefill} />}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[10rem] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search notes"
            aria-label="Search notes"
            className="w-full rounded-lg border border-brand-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
        </div>
        {FILTERS.map(f => (
          <Chip key={f.value} active={filter === f.value} onClick={() => setFilter(f.value)}>{f.label}</Chip>
        ))}
      </div>

      {allLabels.length > 0 && !inTrash && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {allLabels.map(l => (
            <button
              key={l}
              onClick={() => setLabel(prev => (prev === l ? null : l))}
              className={cn('rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors', label === l ? 'bg-gray-700 text-white' : 'bg-brand-100 text-gray-600 hover:bg-brand-200')}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      {inTrash && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-brand-100 px-4 py-2.5 text-sm text-gray-600">
          <span>Notes in the Trash are deleted after 30 days.</span>
          {trashed.length > 0 && (
            <button
              type="button"
              onClick={() => { if (window.confirm('Delete everything in the Trash forever?')) startTransition(async () => { const r = await emptyTrash(); if (r.error) toast(r.error, 'error') }) }}
              className="inline-flex items-center gap-1 font-bold text-red-600 hover:underline"
            >
              <Trash2 className="h-4 w-4" /> Empty Trash
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">
          {inTrash ? 'Trash is empty' : filter === 'archived' ? 'Nothing archived' : query || label ? 'No notes match' : 'No notes yet. Take your first one above.'}
        </p>
      ) : (
        <div className="space-y-5">
          {pinned.length > 0 && (
            <section>
              <h2 className={sectionLabel}>Pinned</h2>
              {grid(pinned)}
            </section>
          )}
          {rest.length > 0 && (
            <section>
              {pinned.length > 0 && <h2 className={sectionLabel}>Others</h2>}
              {grid(rest)}
            </section>
          )}
        </div>
      )}
    </div>
  )
}
