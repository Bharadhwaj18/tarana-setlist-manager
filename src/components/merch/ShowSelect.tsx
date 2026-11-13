'use client'

import { useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { showMatches } from '@/components/finance/ShowPicker'

export interface ShowChoice { id: string; title: string; show_date: string | null; venue?: string | null }

const shortDate = (d: string | null) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '')

/**
 * Pick a show by typing (matches name, venue or date) or by scrolling. Opens in place, so it works inside a modal.
 * `noneLabel` adds a "not at a show" choice (value ''); without it a show must be picked.
 */
export function ShowSelect({ id, shows, value, onChange, noneLabel, placeholder = 'Pick a show' }: {
  id: string
  shows: ShowChoice[]
  value: string
  onChange: (id: string) => void
  noneLabel?: string
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const matches = shows.filter(s => showMatches({ title: s.title, venue: s.venue ?? null, show_date: s.show_date }, query))
  const selected = shows.find(s => s.id === value)
  const typed = query.trim()

  const close = () => { setOpen(false); setQuery('') }
  const pick = (v: string) => { onChange(v); close() }

  return (
    <div>
      <button
        type="button" id={id} aria-expanded={open} onClick={() => (open ? close() : setOpen(true))}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
      >
        <span className={cn('min-w-0 truncate', !selected && 'text-gray-500')}>
          {selected ? <>{selected.title}{selected.show_date && <span className="text-gray-500"> · {shortDate(selected.show_date)}</span>}</> : value === '' && noneLabel ? noneLabel : placeholder}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="mt-2 overflow-hidden rounded-xl border border-brand-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-brand-100 px-3">
            <Search className="h-4 w-4 shrink-0 text-gray-400" />
            <input
              autoFocus value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }
                // Enter picks the top match, so a few letters and Enter is enough.
                if (e.key === 'Enter') { e.preventDefault(); if (matches[0]) pick(matches[0].id) }
              }}
              placeholder="Type a show, venue or date"
              aria-label="Search shows"
              className="min-h-11 w-full bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
            />
          </div>
          <ul className="max-h-60 overflow-y-auto py-1">
            {noneLabel && typed === '' && (
              <li>
                <button type="button" onClick={() => pick('')} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-600 hover:bg-brand-50">
                  <span className="flex-1">{noneLabel}</span>
                  {value === '' && <Check className="h-4 w-4 text-brand-600" />}
                </button>
              </li>
            )}
            {matches.map(s => (
              <li key={s.id}>
                <button type="button" onClick={() => pick(s.id)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-brand-50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-gray-900">{s.title}</span>
                    <span className="block truncate text-xs text-gray-500">{[shortDate(s.show_date), s.venue].filter(Boolean).join(' · ')}</span>
                  </span>
                  {value === s.id && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
                </button>
              </li>
            ))}
            {matches.length === 0 && <li className="px-3 py-2.5 text-sm text-gray-500">{shows.length ? `No show matching “${typed}”.` : 'No shows to pick from.'}</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
