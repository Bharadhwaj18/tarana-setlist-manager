'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NoteCard } from './NoteCard'
import type { Note, ChecklistItem } from '@/types'

interface Props {
  notes: Note[]
  checklistByNote: Record<string, ChecklistItem[]>
  /** Pre-resolved server-side, keyed by note id. */
  authorLines: Record<string, string>
}

type Filter = 'all' | 'pinned' | 'archived'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pinned', label: 'Pinned' },
  { value: 'archived', label: 'Archived' },
]

export function NotesList({ notes, checklistByNote, authorLines }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [label, setLabel] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const allLabels = useMemo(() => [...new Set(notes.flatMap(n => n.labels ?? []))].sort(), [notes])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = filter === 'archived' ? notes.filter(n => n.archived_at) : notes.filter(n => !n.archived_at)
    return base
      .filter(n => filter !== 'pinned' || n.pinned)
      .filter(n => !label || (n.labels ?? []).includes(label))
      .filter(n => {
        if (!q) return true
        const haystack = [n.title, n.content ?? '', ...(n.labels ?? []), ...(checklistByNote[n.id] ?? []).map(i => i.text)].join(' ').toLowerCase()
        return haystack.includes(q)
      })
  }, [notes, filter, label, query, checklistByNote])

  // Pinned first; otherwise keep the incoming most-recently-updated order.
  const sorted = [...filtered].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))

  return (
    <div>
      <div className="mb-4 relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search notes"
          aria-label="Search notes"
          className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn('rounded-full px-3 py-1.5 text-xs font-semibold transition-colors', filter === f.value ? 'bg-brand-400 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
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
              className={cn('rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors', label === l ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">Nothing here</p>
      ) : (
        // CSS columns give the Keep-style masonry layout; break-inside keeps each card whole.
        <div className="columns-1 gap-3 sm:columns-2 lg:columns-3">
          {sorted.map(note => (
            <div key={note.id} className="mb-3 break-inside-avoid">
              <NoteCard note={note} checklistItems={checklistByNote[note.id] ?? []} authorLine={authorLines[note.id] ?? ''} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
