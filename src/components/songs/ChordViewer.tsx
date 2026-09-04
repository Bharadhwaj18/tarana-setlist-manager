'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { ChevronUp, ChevronDown, Save, MonitorPlay, Play, Pause, Minus, Plus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { parseSong } from '@/lib/chords/parser'
import { formatSong, formatSongAsChordPro, getCss } from '@/lib/chords/formatter'
import { transposeSong, transposeKey } from '@/lib/chords/transposer'
import { getLightChordSheetCss } from '@/lib/chords/theme'
import { saveTranspose } from '@/actions/songs'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toaster'
import { useAutoScroll } from '@/hooks/useAutoScroll'
import { PerformanceMode, type SetlistNavSong } from './PerformanceMode'
import type { Song } from 'chordsheetjs'

// Scroll speed is shown as a percentage (100% = normal) rather than a raw
// px/sec number. useAutoScroll's default speed (40px/s) is what 100% maps to.
// Percent is derived from `speed` on every render rather than tracked as its
// own state — speed (inside useAutoScroll) stays the single source of truth.
const SCROLL_BASE_SPEED = 40
const SCROLL_PERCENT_MIN = 20
const SCROLL_PERCENT_MAX = 200
const SCROLL_PERCENT_STEP = 10

const CHORD_VIEWER_CSS_ID = 'chord-viewer-css'

interface ChordViewerProps {
  chordChart: string
  songKey?: string | null
  printRef?: React.RefObject<HTMLDivElement | null>
  songId?: string
  songTitle?: string
  bpm?: number | null
  setlistSongs?: SetlistNavSong[]
  setlistId?: string
}

export function ChordViewer({
  chordChart, songKey, printRef, songId, songTitle, bpm, setlistSongs, setlistId
}: ChordViewerProps) {
  const [song, setSong] = useState<Song>(() => parseSong(chordChart))
  const [semitones, setSemitones] = useState(0)
  const [performMode, setPerformMode] = useState(false)
  const [isSaving, startSave] = useTransition()
  const internalRef = useRef<HTMLDivElement>(null)
  // Dedicated, self-contained scroll container — same technique as
  // PerformanceMode's `scrollRef`: a definite-height `overflow-y-auto` box
  // that useAutoScroll drives directly, instead of reaching into the shared
  // app layout (whose height depends on ancestor CSS we don't control here).
  const scrollRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const toast = useToast()

  const { isScrolling, setIsScrolling, speed, setSpeed } = useAutoScroll(scrollRef)
  const scrollPercent = Math.round((speed / SCROLL_BASE_SPEED) * 100)

  const adjustScrollSpeed = (deltaPercent: number) => {
    setSpeed(prevSpeed => {
      const currentPercent = Math.round((prevSpeed / SCROLL_BASE_SPEED) * 100)
      const nextPercent = Math.min(
        SCROLL_PERCENT_MAX,
        Math.max(SCROLL_PERCENT_MIN, currentPercent + deltaPercent)
      )
      return (SCROLL_BASE_SPEED * nextPercent) / 100
    })
  }

  useEffect(() => {
    // Injected once per page (shared by every ChordViewer instance) — check
    // the DOM directly rather than tracking it as component state.
    if (document.getElementById(CHORD_VIEWER_CSS_ID)) return
    const style = document.createElement('style')
    style.id = CHORD_VIEWER_CSS_ID
    style.textContent = getCss() + '\n' + getLightChordSheetCss()
    document.head.appendChild(style)
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
      <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400">
        No chord chart added yet.{' '}
        {songId ? (
          <Link href={`/songs/${songId}/edit`} className="font-medium text-brand-500 underline underline-offset-2 hover:text-brand-600">
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
        {/* Transpose + Perform controls */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5">
          <span className="text-sm font-medium text-gray-600">Transpose</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => transpose(-1)} className="h-7 w-7 p-0">
              <ChevronDown className="h-4 w-4" />
            </Button>
            <span className="w-16 text-center text-sm font-mono font-semibold text-brand-500">
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

          {/* Perform button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPerformMode(true)}
            className="ml-auto text-brand-600 hover:text-brand-700"
          >
            <MonitorPlay className="h-4 w-4" />
            <span className="hidden sm:inline">Perform</span>
          </Button>
        </div>

        {/*
          Bounded height + overflow-y-auto here is what makes the auto-scroll
          actually work — it needs an element that genuinely overflows itself,
          not one whose height passively depends on an ancestor (the shared
          app shell doesn't guarantee that). Same idea as PerformanceMode's
          own scrollRef container.
        */}
        <div ref={scrollRef} className="max-h-[70vh] overflow-y-auto rounded-lg ring-1 ring-gray-100">
          <div
            ref={printRef ?? internalRef}
            className="bg-white p-6"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>

      {/*
        Floating scroll island — fixed to the viewport (not the page flow) so
        it stays reachable no matter how far down the chord sheet you've
        scrolled. `lg:left-56` keeps it centered in the content area rather
        than behind the desktop sidebar; it sits below Perform mode's
        overlay (z-[200]) so it's hidden automatically while that's open.
      */}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 lg:left-56">
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-gray-800 bg-gray-900/95 px-2 py-1.5 text-white shadow-lg backdrop-blur-sm">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsScrolling(!isScrolling)}
            className="h-8 gap-1.5 rounded-full px-3 text-white hover:bg-white/10 hover:text-white"
          >
            {isScrolling ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {isScrolling ? 'Pause' : 'Scroll'}
          </Button>
          <div className="h-5 w-px bg-white/10" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => adjustScrollSpeed(-SCROLL_PERCENT_STEP)}
            className="h-8 w-8 rounded-full p-0 text-white hover:bg-white/10 hover:text-white"
            title="Slower"
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <span className="w-12 text-center text-sm font-mono font-semibold text-amber-400">
            {scrollPercent}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => adjustScrollSpeed(SCROLL_PERCENT_STEP)}
            className="h-8 w-8 rounded-full p-0 text-white hover:bg-white/10 hover:text-white"
            title="Faster"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {performMode && (
        <PerformanceMode
          song={song}
          songKey={currentKey ?? null}
          songId={songId ?? ''}
          songTitle={songTitle ?? 'Song'}
          bpm={bpm}
          setlistSongs={setlistSongs}
          setlistId={setlistId}
          onClose={() => setPerformMode(false)}
        />
      )}
    </>
  )
}
