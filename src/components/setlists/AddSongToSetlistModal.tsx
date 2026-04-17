'use client'

import { useState, useTransition } from 'react'
import { Search, Plus, Check, PlusCircle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { addSongToSetlist, quickCreateSongAndAdd } from '@/actions/setlists'
import { useToast } from '@/components/ui/Toaster'
import type { Song } from '@/types'

interface AddSongToSetlistModalProps {
  setlistId: string
  allSongs: Song[]
  currentSongIds: string[]
}

function similarity(a: string, b: string): number {
  a = a.toLowerCase()
  b = b.toLowerCase()
  if (a === b) return 1
  if (b.includes(a) || a.includes(b)) return 0.9

  // Count matching characters (order-sensitive subsequence scoring)
  let i = 0, j = 0, matches = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { matches++; i++; j++ }
    else { j++ }
  }
  const subseqScore = matches / Math.max(a.length, b.length)

  // Bigram overlap
  const bigrams = (s: string) => {
    const set = new Set<string>()
    for (let k = 0; k < s.length - 1; k++) set.add(s[k] + s[k + 1])
    return set
  }
  const ba = bigrams(a), bb = bigrams(b)
  let shared = 0
  ba.forEach(g => { if (bb.has(g)) shared++ })
  const bigramScore = (2 * shared) / (ba.size + bb.size || 1)

  return Math.max(subseqScore, bigramScore)
}

const FUZZY_THRESHOLD = 0.4

export function AddSongToSetlistModal({ setlistId, allSongs, currentSongIds }: AddSongToSetlistModalProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [addedIds, setAddedIds] = useState<string[]>(currentSongIds)
  const [localSongs, setLocalSongs] = useState<Song[]>(allSongs)
  const [, startTransition] = useTransition()
  const toast = useToast()

  const q = query.trim()

  const scored = q
    ? localSongs
        .map(s => {
          const titleScore = similarity(q, s.title)
          const artistScore = s.artist ? similarity(q, s.artist) * 0.7 : 0
          return { song: s, score: Math.max(titleScore, artistScore) }
        })
        .filter(x => x.score >= FUZZY_THRESHOLD)
        .sort((a, b) => b.score - a.score)
    : localSongs.map(s => ({ song: s, score: 1 }))

  const exactMatch = q
    ? localSongs.some(s => s.title.toLowerCase() === q.toLowerCase())
    : false

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

  const handleCreate = () => {
    if (!q) return
    setCreating(true)
    startTransition(async () => {
      try {
        const result = await quickCreateSongAndAdd(setlistId, q)
        if ('error' in result) {
          toast(result.error, 'error')
        } else {
          setLocalSongs(prev => [...prev, result.song as Song])
          setAddedIds(prev => [...prev, result.song.id])
          toast(`"${result.song.title}" created and added`, 'success')
          setQuery('')
        }
      } catch {
        toast('Failed to create song', 'error')
      } finally {
        setCreating(false)
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
          {scored.length === 0 && !q && (
            <p className="py-8 text-center text-sm text-gray-400">No songs in library</p>
          )}

          {scored.map(({ song }) => {
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

          {/* Create option — shown when query is non-empty and no exact title match */}
          {q && !exactMatch && (
            <div className="mt-2 border-t border-brand-100 pt-2">
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-brand-700 hover:bg-brand-50 disabled:opacity-50"
              >
                <PlusCircle className="h-4 w-4 shrink-0" />
                <span>
                  {creating ? 'Creating…' : <>Create <span className="font-semibold">"{q}"</span> and add to setlist</>}
                </span>
              </button>
            </div>
          )}

          {scored.length === 0 && q && !exactMatch && (
            <p className="py-4 text-center text-xs text-gray-400">No similar songs found</p>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={() => setOpen(false)}>Done</Button>
        </div>
      </Modal>
    </>
  )
}
