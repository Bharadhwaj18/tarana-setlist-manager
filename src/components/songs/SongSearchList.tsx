'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { SongCard } from './SongCard'
import type { Song } from '@/types'

export function SongSearchList({ songs }: { songs: Song[] }) {
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? songs.filter(s =>
        s.title.toLowerCase().includes(query.toLowerCase()) ||
        s.artist?.toLowerCase().includes(query.toLowerCase()) ||
        s.song_key?.toLowerCase().includes(query.toLowerCase())
      )
    : songs

  return (
    <div>
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-300" />
        <input
          type="text"
          placeholder="Search by title, artist or key…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full rounded-lg border border-brand-200 bg-white py-2.5 pl-9 pr-3 text-sm placeholder-gray-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">
          {query ? `No songs matching "${query}"` : 'No songs yet'}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(song => (
            <SongCard key={song.id} song={song} />
          ))}
        </div>
      )}
    </div>
  )
}
