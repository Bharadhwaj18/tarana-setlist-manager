'use client'

import { useState, useMemo, useTransition } from 'react'
import { Upload, Music2, Tag, AlertCircle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { parseSetlistText, type ParsedSong } from '@/lib/setlist-parser'
import { bulkImportSongs } from '@/actions/setlists'
import { useToast } from '@/components/ui/Toaster'
import { cn } from '@/lib/utils'
import type { Song } from '@/types'

interface BulkImportModalProps {
  setlistId: string
  existingSongs: Song[]
  currentSongTitles: string[]
}

export function BulkImportModal({ setlistId, existingSongs, currentSongTitles }: BulkImportModalProps) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
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

  const handleImport = () => {
    if (!parsed.length) return
    startTransition(async () => {
      try {
        const { imported, created } = await bulkImportSongs(setlistId, parsed)
        toast(
          `Added ${imported} song${imported !== 1 ? 's' : ''} (${created} new to library)`,
          'success'
        )
        setOpen(false)
        setText('')
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Import failed', 'error')
      }
    })
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" />
        Bulk Import
      </Button>

      <Modal
        open={open}
        onOpenChange={open => { setOpen(open); if (!open) setText('') }}
        title="Bulk Import Songs"
        description="Paste a numbered setlist. Songs are auto-created in the library if they don't exist."
        className="max-w-2xl"
      >
        <div className="space-y-4">
          {/* Paste area */}
          <textarea
            className="w-full rounded-md border border-brand-200 bg-white px-3 py-2.5 font-mono text-sm leading-relaxed placeholder-gray-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
            rows={10}
            placeholder={`Paste your setlist here, e.g.:\n\nMain Set\n1. Manovega E\n2. Om shivoham C#\n3. Aigiri D\n\nExtra\n1. Nagumo C\n2. Baaro krishnayya`}
            value={text}
            onChange={e => setText(e.target.value)}
            autoFocus
          />

          {/* Preview */}
          {parsed.length > 0 && (
            <div className="rounded-lg border border-brand-200 bg-brand-50">
              {/* Summary bar */}
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

              {/* Grouped song list */}
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
                                <span className="rounded-full bg-brand-200 px-1.5 py-0.5 text-xs font-medium text-brand-700">
                                  new
                                </span>
                              )}
                              {inSetlist && (
                                <span className="text-xs text-gray-400">skip</span>
                              )}
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
            <Button variant="secondary" onClick={() => { setOpen(false); setText('') }}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              loading={isPending}
              disabled={parsed.length === 0 || parsed.length === alreadyInSetlistCount}
            >
              Import {parsed.length > 0 ? `${parsed.length - alreadyInSetlistCount} songs` : ''}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
