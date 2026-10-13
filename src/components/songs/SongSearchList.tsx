'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Chip } from '@/components/ui/Chip'
import { SongRow } from './SongRow'
import type { Song } from '@/types'

interface SongSearchListProps {
  songs: Song[]
  setlistCounts: Record<string, number>
}

const letterOf = (title: string) => {
  const c = title.trim()[0]?.toUpperCase() ?? '#'
  return /[A-Z]/.test(c) ? c : '#'
}

export function SongSearchList({ songs, setlistCounts }: SongSearchListProps) {
  const [query, setQuery] = useState('')
  const [needsChart, setNeedsChart] = useState(false)
  const [key, setKey] = useState('')

  const needChartCount = useMemo(() => songs.filter(s => !s.chord_chart).length, [songs])
  const keys = useMemo(() => [...new Set(songs.map(s => s.song_key).filter((k): k is string => !!k))].sort(), [songs])

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = songs
      .filter(s => !needsChart || !s.chord_chart)
      .filter(s => !key || s.song_key === key)
      .filter(s => !q || s.title.toLowerCase().includes(q) || s.artist?.toLowerCase().includes(q) || s.song_key?.toLowerCase().includes(q))
      .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
    const byLetter = new Map<string, Song[]>()
    for (const s of filtered) {
      const l = letterOf(s.title)
      byLetter.set(l, [...(byLetter.get(l) ?? []), s])
    }
    return [...byLetter.entries()]
  }, [songs, query, needsChart, key])

  const jumpTo = (letter: string) => document.getElementById(`songs-letter-${letter}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-300" />
        <input
          type="text"
          placeholder="Search by title, artist or key…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full rounded-xl border border-brand-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
        />
      </div>

      <div className="no-scrollbar mb-4 flex items-center gap-2 overflow-x-auto">
        <Chip active={!needsChart && !key} onClick={() => { setNeedsChart(false); setKey('') }}>All {songs.length}</Chip>
        {needChartCount > 0 && (
          <Chip active={needsChart} onClick={() => setNeedsChart(v => !v)}>Needs chart {needChartCount}</Chip>
        )}
        {keys.length > 0 && (
          <select
            value={key}
            onChange={e => setKey(e.target.value)}
            aria-label="Filter by key"
            className={`shrink-0 rounded-full border-0 px-3.5 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-400 ${key ? 'bg-brand-400 text-white' : 'bg-brand-100 text-gray-700'}`}
          >
            <option value="">Key</option>
            {keys.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">{query ? `No songs matching "${query}"` : 'No songs match these filters'}</p>
      ) : (
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-brand-200 bg-white">
            {groups.map(([letter, items]) => (
              <section key={letter}>
                <h2 id={`songs-letter-${letter}`} className="scroll-mt-4 border-y border-brand-200 bg-gray-50 px-4 py-1.5 font-display text-sm font-bold text-brand-600 first:border-t-0">
                  {letter}
                </h2>
                {items.map(song => <SongRow key={song.id} song={song} setlistCount={setlistCounts[song.id] ?? 0} />)}
              </section>
            ))}
          </div>
          <nav aria-label="Jump to letter" className="sticky top-4 flex flex-col items-center gap-0.5 text-[10px] font-extrabold text-gray-400">
            {groups.map(([letter]) => (
              <button key={letter} type="button" onClick={() => jumpTo(letter)} className="px-1 py-0.5 hover:text-brand-600">{letter}</button>
            ))}
          </nav>
        </div>
      )}
    </div>
  )
}
