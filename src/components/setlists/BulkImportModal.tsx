'use client'

import { useState, useMemo, useTransition } from 'react'
import { Upload, Music2, Tag, AlertCircle, Search, Check, ChevronLeft, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { parseSetlistText, type ParsedSong } from '@/lib/setlist-parser'
import { bulkImportSongs } from '@/actions/setlists'
import { similarity, FUZZY_THRESHOLD } from '@/lib/fuzzy'
import { useToast } from '@/components/ui/Toaster'
import { cn } from '@/lib/utils'
import type { Song } from '@/types'

interface BulkImportModalProps {
  setlistId: string
  existingSongs: Song[]
  currentSongTitles: string[]
}

interface Unmatched {
  parsedTitle: string
  parsedKey?: string
}

export function BulkImportModal({ setlistId, existingSongs, currentSongTitles }: BulkImportModalProps) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [step, setStep] = useState<'input' | 'resolve'>('input')
  const [unmatched, setUnmatched] = useState<Unmatched[]>([])
  // parsedTitle → existing song ID chosen by user (undefined = create new)
  const [resolutions, setResolutions] = useState<Record<string, string | undefined>>({})
  // per-row search query
  const [queries, setQueries] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  const existingTitleSet = useMemo(
    () => new Set(existingSongs.map(s => s.title.toLowerCase().trim())),
    [existingSongs]
  )
  const currentTitleSet = useMemo(
    () => new Set(currentSongTitles.map(t => t.toLowerCase().trim())),
    [currentSongTitles]
  )

  const parsed: ParsedSong[] = useMemo(
    () => (text.trim() ? parseSetlistText(text) : []),
    [text]
  )

  const sections = useMemo(() => {
    const map = new Map<string, ParsedSong[]>()
    for (const song of parsed) {
      if (!map.has(song.section)) map.set(song.section, [])
      map.get(song.section)!.push(song)
    }
    return map
  }, [parsed])

  const newSongCount = parsed.filter(
    s => !existingTitleSet.has(s.title.toLowerCase().trim())
  ).length

  const alreadyInSetlistCount = parsed.filter(
    s => currentTitleSet.has(s.title.toLowerCase().trim())
  ).length

  function reset() {
    setText('')
    setStep('input')
    setUnmatched([])
    setResolutions({})
    setQueries({})
  }

  // Search results for a given unmatched row
  function searchResults(query: string) {
    const q = query.trim()
    if (!q) return []
    return existingSongs
      .map(s => ({ song: s, score: Math.max(similarity(q, s.title), s.artist ? similarity(q, s.artist) * 0.7 : 0) }))
      .filter(x => x.score >= FUZZY_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
  }

  function handleImportClick() {
    const newUnmatched: Unmatched[] = []
    for (const song of parsed) {
      const key = song.title.toLowerCase().trim()
      if (currentTitleSet.has(key)) continue // already in setlist, will be skipped
      if (!existingTitleSet.has(key)) {
        newUnmatched.push({ parsedTitle: song.title, parsedKey: song.song_key })
      }
    }
    if (newUnmatched.length === 0) {
      doImport({})
      return
    }
    // Pre-fill each search input with the parsed title
    const initQueries: Record<string, string> = {}
    for (const u of newUnmatched) initQueries[u.parsedTitle] = u.parsedTitle
    setUnmatched(newUnmatched)
    setQueries(initQueries)
    setStep('resolve')
  }

  function doImport(finalResolutions: Record<string, string | undefined>) {
    startTransition(async () => {
      const preResolvedIds: Record<string, string> = {}
      for (const [title, songId] of Object.entries(finalResolutions)) {
        if (songId) preResolvedIds[title.toLowerCase().trim()] = songId
      }
      try {
        const { imported, created } = await bulkImportSongs(setlistId, parsed, preResolvedIds)
        toast(
          `Added ${imported} song${imported !== 1 ? 's' : ''} (${created} new to library)`,
          'success'
        )
        setOpen(false)
        reset()
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Import failed', 'error')
      }
    })
  }

  const resolvedCount = unmatched.filter(u => resolutions[u.parsedTitle] !== undefined).length

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" />
        Bulk Import
      </Button>

      <Modal
        open={open}
        onOpenChange={o => { setOpen(o); if (!o) reset() }}
        title={step === 'input' ? 'Bulk Import Songs' : `Match ${unmatched.length} unmatched song${unmatched.length !== 1 ? 's' : ''}`}
        description={
          step === 'input'
            ? 'Paste a numbered setlist. Songs are auto-created in the library if they don\'t exist.'
            : 'Search your library for each song, or leave blank to create a new entry.'
        }
        className="max-w-2xl"
      >
        {/* ── Step 1: Input + Preview ─────────────────────── */}
        {step === 'input' && (
          <div className="space-y-4">
            <textarea
              className="w-full rounded-md border border-brand-200 bg-white px-3 py-2.5 font-mono text-sm leading-relaxed placeholder-gray-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
              rows={10}
              placeholder={`Paste your setlist here, e.g.:\n\nMain Set\n1. Manovega E\n2. Om shivoham C#\n3. Aigiri D\n\nExtra\n1. Nagumo C\n2. Baaro krishnayya`}
              value={text}
              onChange={e => setText(e.target.value)}
              autoFocus
            />

            {parsed.length > 0 && (
              <div className="rounded-lg border border-brand-200 bg-brand-50">
                <div className="flex flex-wrap items-center gap-3 border-b border-brand-200 px-4 py-2.5 text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-brand-700">
                    <Music2 className="h-3.5 w-3.5" />
                    {parsed.length} songs detected
                  </span>
                  {newSongCount > 0 && (
                    <span className="rounded-full bg-brand-300 px-2 py-0.5 font-medium text-brand-700">
                      +{newSongCount} new to library
                    </span>
                  )}
                  {alreadyInSetlistCount > 0 && (
                    <span className="flex items-center gap-1 text-brand-500">
                      <AlertCircle className="h-3 w-3" />
                      {alreadyInSetlistCount} already in setlist (will skip)
                    </span>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto p-3 space-y-4">
                  {Array.from(sections.entries()).map(([section, songs]) => (
                    <div key={section}>
                      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-400">
                        <Tag className="h-3 w-3" />
                        {section}
                      </p>
                      <div className="space-y-1">
                        {songs.map((song, i) => {
                          const key = song.title.toLowerCase().trim()
                          const isNew = !existingTitleSet.has(key)
                          const inSetlist = currentTitleSet.has(key)
                          return (
                            <div
                              key={i}
                              className={cn(
                                'flex items-center justify-between rounded-md px-3 py-1.5 text-sm',
                                inSetlist ? 'opacity-40' : 'bg-white'
                              )}
                            >
                              <span className={cn('font-medium', inSetlist ? 'line-through text-gray-400' : 'text-gray-900')}>
                                {song.title}
                              </span>
                              <div className="flex items-center gap-2">
                                {song.song_key && (
                                  <span className="rounded bg-brand-100 px-1.5 py-0.5 text-xs font-bold text-brand-700">
                                    {song.song_key}
                                  </span>
                                )}
                                {isNew && !inSetlist && (
                                  <span className="rounded-full bg-brand-200 px-1.5 py-0.5 text-xs font-medium text-brand-700">new</span>
                                )}
                                {inSetlist && <span className="text-xs text-gray-400">skip</span>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!parsed.length && text.trim() && (
              <p className="text-sm text-brand-500">
                No numbered items detected. Make sure lines start with a number like &ldquo;1. Song title&rdquo;.
              </p>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <Button variant="secondary" onClick={() => { setOpen(false); reset() }}>Cancel</Button>
              <Button
                onClick={handleImportClick}
                loading={isPending}
                disabled={parsed.length === 0 || parsed.length === alreadyInSetlistCount}
              >
                Import {parsed.length > 0 ? `${parsed.length - alreadyInSetlistCount} songs` : ''}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Resolve unmatched songs ─────────────── */}
        {step === 'resolve' && (
          <div className="space-y-3">
            <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1">
              {unmatched.map(({ parsedTitle, parsedKey }) => {
                const resolvedId = resolutions[parsedTitle]
                const resolvedSong = resolvedId ? existingSongs.find(s => s.id === resolvedId) : null
                const query = queries[parsedTitle] ?? parsedTitle
                const results = resolvedSong ? [] : searchResults(query)

                return (
                  <div key={parsedTitle} className="rounded-lg border border-brand-200 bg-brand-50 p-3">
                    {/* Song from paste */}
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">"{parsedTitle}"</span>
                      {parsedKey && (
                        <span className="rounded bg-brand-100 px-1.5 py-0.5 text-xs font-bold text-brand-700">{parsedKey}</span>
                      )}
                      <span className="text-xs text-gray-400">from your list</span>
                    </div>

                    {resolvedSong ? (
                      /* Resolved state */
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 shrink-0 text-green-600" />
                        <span className="text-sm text-green-700">
                          Using <span className="font-medium">{resolvedSong.title}</span>
                          {resolvedSong.song_key && (
                            <span className="ml-1.5 rounded bg-green-100 px-1.5 py-0.5 text-xs font-bold text-green-700">{resolvedSong.song_key}</span>
                          )}
                        </span>
                        <button
                          onClick={() => setResolutions(r => ({ ...r, [parsedTitle]: undefined }))}
                          className="ml-auto text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      /* Search state */
                      <>
                        <div className="relative mb-2">
                          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-300" />
                          <input
                            type="text"
                            value={query}
                            onChange={e => setQueries(q => ({ ...q, [parsedTitle]: e.target.value }))}
                            placeholder="Search library…"
                            className="w-full rounded-md border border-brand-200 bg-white py-1.5 pl-8 pr-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                          />
                          {query && (
                            <button
                              onClick={() => setQueries(q => ({ ...q, [parsedTitle]: '' }))}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        {results.length > 0 && (
                          <div className="space-y-1 mb-2">
                            {results.map(({ song }) => (
                              <button
                                key={song.id}
                                onClick={() => setResolutions(r => ({ ...r, [parsedTitle]: song.id }))}
                                className="flex w-full items-center justify-between rounded-md bg-white px-3 py-2 text-left text-sm hover:bg-brand-100"
                              >
                                <span className="font-medium text-gray-900">{song.title}</span>
                                <div className="flex items-center gap-2 shrink-0">
                                  {song.song_key && (
                                    <span className="rounded bg-brand-100 px-1.5 py-0.5 text-xs font-bold text-brand-700">{song.song_key}</span>
                                  )}
                                  {song.artist && <span className="text-xs text-gray-400">{song.artist}</span>}
                                  <span className="text-xs font-medium text-brand-600">Use this</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}

                        {query.trim() && results.length === 0 && (
                          <p className="mb-1 text-xs text-gray-400 px-1">No matches found</p>
                        )}

                        <p className="text-xs text-gray-400 px-1">
                          Leave blank to create <span className="font-medium text-gray-600">"{parsedTitle}"</span> as a new song
                        </p>
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-brand-100 pt-3">
              <Button variant="secondary" size="sm" onClick={() => setStep('input')}>
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
              <div className="flex items-center gap-3">
                {resolvedCount > 0 && (
                  <span className="text-xs text-gray-500">{resolvedCount} of {unmatched.length} matched</span>
                )}
                <Button onClick={() => doImport(resolutions)} loading={isPending}>
                  Confirm & Import
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
