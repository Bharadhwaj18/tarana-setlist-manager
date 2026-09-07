'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, CalendarDays, MapPin, CheckCircle2, Circle } from 'lucide-react'
import type { Show } from '@/types'

interface ShowSearchListProps {
  shows: Show[]
  netByShow: Record<string, number>
  setlistByShow: Record<string, { id: string; title: string } | undefined>
}

function fmt(n: number) {
  return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export function ShowSearchList({ shows, netByShow, setlistByShow }: ShowSearchListProps) {
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const filtered = q
    ? shows.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.venue?.toLowerCase().includes(q) ||
        s.notes?.toLowerCase().includes(q) ||
        setlistByShow[s.id]?.title.toLowerCase().includes(q)
      )
    : shows

  return (
    <div>
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-300" />
        <input
          type="text"
          placeholder="Search by title, venue, or notes…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full rounded-lg border border-brand-200 bg-white py-2.5 pl-9 pr-3 text-sm placeholder-gray-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">
          {query ? `No shows matching "${query}"` : 'No shows yet'}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => {
            const isSplit = !!s.split_at
            const net = netByShow[s.id] ?? 0
            const setlist = setlistByShow[s.id]
            const date = s.show_date
              ? new Date(s.show_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
              : null

            return (
              <Link
                key={s.id}
                href={`/shows/${s.id}`}
                className="flex flex-col gap-2 rounded-xl border border-brand-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-400 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-gray-900">{s.title}</p>
                    {s.tds_applicable && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">TDS</span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    {date && <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{date}</span>}
                    {s.venue && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{s.venue}</span>}
                    <span className={setlist ? 'text-green-600' : 'text-gray-400'}>
                      {setlist ? `Setlist: ${setlist.title}` : 'No setlist yet'}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-4 sm:justify-end">
                  <span className="text-sm font-bold text-gray-700">{fmt(net)}</span>
                  <span className={`flex items-center gap-1 text-xs font-medium ${isSplit ? 'text-green-600' : 'text-amber-600'}`}>
                    {isSplit ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                    {isSplit ? 'Split' : 'Unsplit'}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
