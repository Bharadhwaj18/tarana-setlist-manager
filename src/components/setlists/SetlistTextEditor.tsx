'use client'

import { useState, useMemo, useTransition } from 'react'
import { Search, Check, ChevronLeft, RotateCcw } from 'lucide-react'
import { parseSetlistText, type ParsedSong } from '@/lib/setlist-parser'
import { syncSetlistFromText } from '@/actions/setlists'
import { similarity, FUZZY_THRESHOLD } from '@/lib/fuzzy'
import { useToast } from '@/components/ui/Toaster'
import { Button } from '@/components/ui/Button'
import type { Song } from '@/types'

interface SetlistTextEditorProps {
  setlistId: string
  initialText: string
  existingSongs: Song[]
}

interface Unmatched {
  parsedTitle: string
  parsedKey?: string
}

export function SetlistTextEditor({ setlistId, initialText, existingSongs }: SetlistTextEditorProps) {
  const [text, setText] = useState(initialText)
  const [step, setStep] = useState<'edit' | 'resolve'>('edit')
  const [unmatched, setUnmatched] = useState<Unmatched[]>([])
  const [resolutions, setResolutions] = useState<Record<string, string | undefined>>({})
  const [queries, setQueries] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  const existingTitleSet = useMemo(
    () => new Set(existingSongs.map(s => s.title.toLowerCase().trim())),
    [existingSongs]
  )

  const parsed: ParsedSong[] = useMemo(() => parseSetlistText(text), [text])
  const sectionCount = useMemo(() => new Set(parsed.map(s => s.section)).size, [parsed])
  const newSongCount = useMemo(() => {
    const seen = new Set<string>()
    let count = 0
    for (const s of parsed) {
      const key = s.title.toLowerCase().trim()
      if (seen.has(key)) continue
      seen.add(key)
      if (!existingTitleSet.has(key)) count++
    }
    return count
  }, [parsed, existingTitleSet])

  function searchResults(query: string) {
    const q = query.trim()
    if (!q) return []
    return existingSongs
      .map(s => ({ song: s, score: Math.max(similarity(q, s.title), s.artist ? similarity(q, s.artist) * 0.7 : 0) }))
      .filter(x => x.score >= FUZZY_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
  }

  function handleSaveClick() {
    if (parsed.length === 0 && initialText.trim()) {
      if (!confirm('This leaves the setlist with no songs at all — continue?')) return
    }

    const newUnmatched: Unmatched[] = []
    const seen = new Set<string>()
    for (const song of parsed) {
      const key = song.title.toLowerCase().trim()
      if (seen.has(key)) continue
      seen.add(key)
      if (!existingTitleSet.has(key)) {
        newUnmatched.push({ parsedTitle: song.title, parsedKey: song.song_key })
      }
    }
    if (newUnmatched.length === 0) {
      doSave({})
      return
    }
    const initQueries: Record<string, string> = {}
    for (const u of newUnmatched) initQueries[u.parsedTitle] = u.parsedTitle
    setUnmatched(newUnmatched)
    setQueries(initQueries)
    setStep('resolve')
  }

  function doSave(finalResolutions: Record<string, string | undefined>) {
    startTransition(async () => {
      const preResolvedIds: Record<string, string> = {}
      for (const [title, songId] of Object.entries(finalResolutions)) {
        if (songId) preResolvedIds[title.toLowerCase().trim()] = songId
      }
      try {
        const result = await syncSetlistFromText(setlistId, parsed, preResolvedIds)
        const parts = [`${result.songCount} songs`]
        if (result.created) parts.push(`${result.created} new`)
        if (result.removed) parts.push(`${result.removed} removed`)
        toast(`Setlist updated — ${parts.join(', ')}`, 'success')
        setStep('edit')
        setUnmatched([])
        setResolutions({})
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Failed to save', 'error')
      }
    })
  }

  const resolvedCount = unmatched.filter(u => resolutions[u.parsedTitle] !== undefined).length

  if (step === 'resolve') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-500">
          Search your library for each new song, or leave blank to create it.
        </p>
        <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
          {unmatched.map(({ parsedTitle, parsedKey }) => {
            const resolvedId = resolutions[parsedTitle]
            const resolvedSong = resolvedId ? existingSongs.find(s => s.id === resolvedId) : null
            const query = queries[parsedTitle] ?? parsedTitle
            const results = resolvedSong ? [] : searchResults(query)

            return (
              <div key={parsedTitle} className="rounded-lg border border-brand-200 bg-brand-50 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">&quot;{parsedTitle}&quot;</span>
                  {parsedKey && (
                    <span className="rounded bg-brand-100 px-1.5 py-0.5 text-xs font-bold text-brand-700">{parsedKey}</span>
                  )}
                </div>

                {resolvedSong ? (
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0 text-green-600" />
                    <span className="text-sm text-green-700">
                      Using <span className="font-medium">{resolvedSong.title}</span>
                    </span>
                    <button
                      onClick={() => setResolutions(r => ({ ...r, [parsedTitle]: undefined }))}
                      className="ml-auto text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
                    >
                      Change
                    </button>
                  </div>
                ) : (
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
                    </div>
                    {results.length > 0 && (
                      <div className="mb-2 space-y-1">
                        {results.map(({ song }) => (
                          <button
                            key={song.id}
                            onClick={() => setResolutions(r => ({ ...r, [parsedTitle]: song.id }))}
                            className="flex w-full items-center justify-between rounded-md bg-white px-3 py-2 text-left text-sm hover:bg-brand-100"
                          >
                            <span className="font-medium text-gray-900">{song.title}</span>
                            <span className="text-xs font-medium text-brand-600">Use this</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="px-1 text-xs text-gray-400">
                      Leave blank to create &quot;{parsedTitle}&quot; as a new song
                    </p>
                  </>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-brand-100 pt-3">
          <Button variant="secondary" size="sm" onClick={() => setStep('edit')}>
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
          <div className="flex items-center gap-3">
            {resolvedCount > 0 && (
              <span className="text-xs text-gray-500">{resolvedCount} of {unmatched.length} matched</span>
            )}
            <Button onClick={() => doSave(resolutions)} loading={isPending}>
              Confirm & Save
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <textarea
        className="w-full rounded-md border border-brand-200 bg-white px-3 py-2.5 font-mono text-sm leading-relaxed placeholder-gray-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
        rows={16}
        value={text}
        onChange={e => setText(e.target.value)}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          {parsed.length} song{parsed.length !== 1 ? 's' : ''} · {sectionCount} section{sectionCount !== 1 ? 's' : ''}
          {newSongCount > 0 && <span className="text-brand-600"> · {newSongCount} new to library</span>}
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setText(initialText)}
            disabled={text === initialText}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
          <Button size="sm" onClick={handleSaveClick} loading={isPending} disabled={text === initialText}>
            Save setlist
          </Button>
        </div>
      </div>
    </div>
  )
}
