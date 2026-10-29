'use client'

import { useState } from 'react'
import { Check, ChevronDown, Plus, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Show } from '@/types/shows'

interface Props {
  id: string
  shows: Show[]
  /** The chosen show's id, or `noShow` / `newShow`. */
  value: string
  noShow: string
  newShow: string
  onChange: (value: string) => void
  /** Called with whatever was typed when someone adds a show that isn't in the list. */
  onCreate: (title: string) => void
}

const shortDate = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : ''

/** A show matches when every word typed appears somewhere in its name, venue or date. */
export function showMatches(show: Pick<Show, 'title' | 'venue' | 'show_date'>, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const haystack = `${show.title} ${show.venue ?? ''} ${shortDate(show.show_date)} ${show.show_date ?? ''}`.toLowerCase()
  return words.every(w => haystack.includes(w))
}

/**
 * Pick a show by typing (the list narrows with every letter) or by scrolling the list. Opens in place, so it
 * works inside a modal without being clipped. Also covers "no show" and adding a show that isn't there yet.
 */
export function ShowPicker({ id, shows, value, noShow, newShow, onChange, onCreate }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const matches = shows.filter(s => showMatches(s, query))
  const typed = query.trim()
  const exact = shows.some(s => s.title.trim().toLowerCase() === typed.toLowerCase())
  const selected = shows.find(s => s.id === value)
  const label = value === noShow ? 'No, not for a show' : value === newShow ? 'A new show…' : selected?.title ?? 'No, not for a show'

  const close = () => { setOpen(false); setQuery('') }
  const pick = (v: string) => { onChange(v); close() }

  return (
    <div>
      <button
        type="button"
        id={id}
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-left text-sm text-gray-900 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
      >
        <span className={cn('truncate', value === noShow && 'text-gray-500')}>{label}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="mt-2 overflow-hidden rounded-xl border border-brand-200 bg-white">
          <div className="flex items-center gap-2 border-b border-brand-100 px-3">
            <Search className="h-4 w-4 shrink-0 text-gray-400" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }
                // Enter picks the top match, so typing a few letters and pressing Enter is enough.
                if (e.key === 'Enter') { e.preventDefault(); if (matches[0]) pick(matches[0].id) }
              }}
              placeholder="Type to find a show"
              aria-label="Search shows"
              className="min-h-11 w-full bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {typed === '' && (
              <li>
                <button type="button" onClick={() => pick(noShow)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-600 hover:bg-brand-50">
                  <span className="flex-1">No, not for a show</span>
                  {value === noShow && <Check className="h-4 w-4 text-brand-600" />}
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
            {matches.length === 0 && <li className="px-3 py-2.5 text-sm text-gray-500">No show called “{typed}”.</li>}
            {!exact && (
              <li className="border-t border-brand-100">
                <button type="button" onClick={() => { onCreate(typed); close() }} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-bold text-brand-700 hover:bg-brand-50">
                  <Plus className="h-4 w-4" />{typed ? `Add “${typed}” as a new show` : 'A new show…'}
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
