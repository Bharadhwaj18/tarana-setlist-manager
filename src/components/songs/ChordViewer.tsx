'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { ChevronUp, ChevronDown, Save, MonitorPlay } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { parseSong } from '@/lib/chords/parser'
import { formatSong, formatSongAsChordPro } from '@/lib/chords/formatter'
import { transposeSong, transposeKey } from '@/lib/chords/transposer'
import { ensureChordSheetCss } from './chordSheetStyles'
import { saveTranspose } from '@/actions/songs'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toaster'
import { StageMode, type SetlistNavSong } from './StageMode'
import type { Song } from 'chordsheetjs'

const TEXT_SIZE_MIN = 11
const TEXT_SIZE_MAX = 26
const TEXT_SIZE_DEFAULT = 14

interface ChordViewerProps {
  chordChart: string
  songKey?: string | null
  printRef?: React.RefObject<HTMLDivElement | null>
  songId?: string
  songTitle?: string
  bpm?: number | null
  setlistSongs?: SetlistNavSong[]
  setlistId?: string
  setlistTitle?: string
  /** This song's band notes, shown in Stage mode when it's opened outside a setlist. */
  notes?: string | null
  /** Open straight into Stage mode (e.g. from a setlist's "Stage mode" button). */
  autoStage?: boolean
}

export function ChordViewer({
  chordChart, songKey, printRef, songId, songTitle, bpm, setlistSongs, setlistId, setlistTitle, notes, autoStage,
}: ChordViewerProps) {
  const [song, setSong] = useState<Song>(() => parseSong(chordChart))
  const [semitones, setSemitones] = useState(0)
  const [stageOpen, setStageOpen] = useState(!!autoStage)
  const [textSize, setTextSize] = useState(TEXT_SIZE_DEFAULT)
  const [isSaving, startSave] = useTransition()
  const internalRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const toast = useToast()

  useEffect(() => {
    // Injected once per page (shared by every ChordViewer instance and the editor preview).
    ensureChordSheetCss()
  }, [])

  const transpose = (delta: number) => {
    setSong(prev => transposeSong(prev, delta))
    setSemitones(prev => prev + delta)
  }

  const handleSave = () => {
    if (!songId) return
    const newKey = transposeKey(songKey, semitones)
    const transposedChart = formatSongAsChordPro(song)
    startSave(async () => {
      const result = await saveTranspose(songId, transposedChart, newKey)
      if (result.error) {
        toast(result.error, 'error')
      } else {
        toast('Key saved', 'success')
        router.refresh()
      }
    })
  }

  const currentKey = semitones === 0 ? songKey : transposeKey(songKey, semitones)
  const html = formatSong(song)

  if (!chordChart) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-brand-200 p-10 text-center text-sm text-gray-500">
        No chord chart added yet.{' '}
        {songId ? (
          <Link href={`/songs/${songId}/edit`} className="font-semibold text-brand-600 underline underline-offset-2 hover:text-brand-700">
            Edit song to add chords
          </Link>
        ) : (
          'Edit the song to add chords.'
        )}
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {/* Transpose, text size and Stage mode */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-brand-200 bg-gray-50 px-4 py-2.5">
          <span className="text-xs font-extrabold uppercase tracking-[0.1em] text-gray-500">Transpose</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => transpose(-1)} className="h-7 w-7 p-0">
              <ChevronDown className="h-4 w-4" />
            </Button>
            <span className="w-16 text-center text-sm font-mono font-semibold text-brand-600">
              {semitones > 0 ? `+${semitones}` : semitones === 0 ? 'Original' : semitones}
            </span>
            <Button variant="ghost" size="sm" onClick={() => transpose(1)} className="h-7 w-7 p-0">
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>

          {currentKey && (
            <span className="rounded bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-700">
              Key: {currentKey}
            </span>
          )}

          {semitones !== 0 && (
            <>
              <Button variant="ghost" size="sm" onClick={() => { setSong(parseSong(chordChart)); setSemitones(0) }}>
                Reset
              </Button>
              {songId && (
                <Button size="sm" loading={isSaving} onClick={handleSave}>
                  <Save className="h-3.5 w-3.5" /> Save key
                </Button>
              )}
            </>
          )}

          {/* Text size */}
          <div className="ml-auto flex items-center gap-1 text-gray-500">
            <span className="hidden text-xs font-bold sm:inline">Text</span>
            <Button variant="ghost" size="sm" aria-label="Smaller text" onClick={() => setTextSize(s => Math.max(TEXT_SIZE_MIN, s - 1))} className="h-7 px-2 text-xs font-extrabold">A−</Button>
            <Button variant="ghost" size="sm" aria-label="Larger text" onClick={() => setTextSize(s => Math.min(TEXT_SIZE_MAX, s + 1))} className="h-7 px-2 text-xs font-extrabold">A+</Button>
          </div>

          <Button size="sm" onClick={() => setStageOpen(true)}>
            <MonitorPlay className="h-4 w-4" />
            Stage mode
          </Button>
        </div>

        <div className="rounded-2xl border border-brand-200 bg-white">
          <div
            ref={printRef ?? internalRef}
            className="chord-view p-5 sm:p-6"
            style={{ '--chord-size': `${textSize}px` } as React.CSSProperties}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>

      {stageOpen && (
        <StageMode
          songs={setlistSongs && setlistSongs.some(s => s.id === songId) ? setlistSongs : [{
            id: songId ?? '', title: songTitle ?? 'Song', chord_chart: chordChart, song_key: songKey ?? null, bpm: bpm ?? null, notes,
          }]}
          startSongId={songId ?? ''}
          setlistId={setlistSongs?.some(s => s.id === songId) ? setlistId : undefined}
          setlistTitle={setlistTitle}
          onClose={() => setStageOpen(false)}
        />
      )}
    </>
  )
}
