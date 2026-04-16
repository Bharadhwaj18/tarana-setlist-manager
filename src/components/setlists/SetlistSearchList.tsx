'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { SetlistCard } from './SetlistCard'
import type { Setlist } from '@/types'

interface SetlistSearchListProps {
  setlists: Setlist[]
  countMap: Record<string, number>
  profileMap: Record<string, string>
}

export function SetlistSearchList({ setlists, countMap, profileMap }: SetlistSearchListProps) {
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? setlists.filter(s =>
        s.title.toLowerCase().includes(query.toLowerCase()) ||
        s.venue?.toLowerCase().includes(query.toLowerCase())
      )
    : setlists

  return (
    <div>
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-300" />
        <input
          type="text"
          placeholder="Search by title or venue…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full rounded-lg border border-brand-200 bg-white py-2.5 pl-9 pr-3 text-sm placeholder-gray-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">
          {query ? `No setlists matching "${query}"` : 'No setlists yet'}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(setlist => (
            <SetlistCard
              key={setlist.id}
              setlist={setlist}
              songCount={countMap[setlist.id] ?? 0}
              createdBy={profileMap[setlist.created_by]}
              updatedBy={setlist.updated_by ? profileMap[setlist.updated_by] : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}
