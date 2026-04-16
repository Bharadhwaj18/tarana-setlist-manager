'use client'

import { useState, useTransition } from 'react'
import { Search, Plus, Check } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { addSongToSetlist } from '@/actions/setlists'
import { useToast } from '@/components/ui/Toaster'
import type { Song } from '@/types'

interface AddSongToSetlistModalProps {
  setlistId: string
  allSongs: Song[]
  currentSongIds: string[]
}

export function AddSongToSetlistModal({ setlistId, allSongs, currentSongIds }: AddSongToSetlistModalProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState<string | null>(null)
  const [addedIds, setAddedIds] = useState<string[]>(currentSongIds)
  const [, startTransition] = useTransition()
  const toast = useToast()

  const filtered = allSongs.filter(s =>
    s.title.toLowerCase().includes(query.toLowerCase()) ||
    s.artist?.toLowerCase().includes(query.toLowerCase())
  )

  const handleAdd = (songId: string) => {
    setAdding(songId)
    startTransition(async () => {
      try {
        await addSongToSetlist(setlistId, songId)
        setAddedIds(prev => [...prev, songId])
      } catch {
        toast('Failed to add song', 'error')
      } finally {
        setAdding(null)
      }
    })
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Add Songs
      </Button>

      <Modal open={open} onOpenChange={setOpen} title="Add Songs to Setlist" className="max-w-xl">
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-300" />
          <input
            type="text"
            placeholder="Search songs..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full rounded-md border border-brand-200 py-2 pl-9 pr-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
            autoFocus
          />
        </div>

        {/* Song list */}
        <div className="max-h-80 overflow-y-auto space-y-1">
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400">No songs found</p>
          )}
          {filtered.map(song => {
            const added = addedIds.includes(song.id)
            const isAdding = adding === song.id
            return (
              <div
                key={song.id}
                className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-brand-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{song.title}</p>
                  {song.artist && <p className="truncate text-xs text-gray-400">{song.artist}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {song.song_key && (
                    <span className="text-xs font-bold text-brand-500">{song.song_key}</span>
                  )}
                  {added ? (
                    <span className="flex items-center gap-1 text-xs text-brand-700">
                      <Check className="h-3.5 w-3.5" /> Added
                    </span>
                  ) : (
                    <Button size="sm" variant="ghost" loading={isAdding} onClick={() => handleAdd(song.id)}>
                      <Plus className="h-3.5 w-3.5" /> Add
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={() => setOpen(false)}>Done</Button>
        </div>
      </Modal>
    </>
  )
}
