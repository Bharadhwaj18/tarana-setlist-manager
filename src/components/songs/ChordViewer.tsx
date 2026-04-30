'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { ChevronUp, ChevronDown, Save, MonitorPlay } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { parseSong } from '@/lib/chords/parser'
import { formatSong, formatSongAsChordPro, getCss } from '@/lib/chords/formatter'
import { transposeSong, transposeKey } from '@/lib/chords/transposer'
import { saveTranspose } from '@/actions/songs'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toaster'
import { PerformanceMode, type SetlistNavSong } from './PerformanceMode'
import type { Song } from 'chordsheetjs'

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
  const [cssInjected, setCssInjected] = useState(false)
  const [performMode, setPerformMode] = useState(false)
  const [isSaving, startSave] = useTransition()
  const internalRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const toast = useToast()

  useEffect(() => {
    setSong(parseSong(chordChart))
    setSemitones(0)
  }, [chordChart])

  useEffect(() => {
    if (cssInjected) return
    const style = document.createElement('style')
    style.textContent = getCss() + `
      .chord-sheet { font-family: monospace; font-size: 14px; line-height: 1.8; }
      .chord { color: #d4a373; font-weight: 700; }
      .paragraph { margin-bottom: 1.5rem; }
      .row { display: flex; flex-wrap: wrap; }
      .column { display: flex; flex-direction: column; margin-right: 0.2rem; }
      .comment { color: #6b7280; font-style: italic; margin-bottom: 0.5rem; }
      .section-label { font-weight: 600; color: #374151; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em; margin-bottom: 0.25rem; }
    `
    document.head.appendChild(style)
    setCssInjected(true)
  }, [cssInjected])

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

        <div
          ref={printRef ?? internalRef}
          className="rounded-lg bg-white p-6 ring-1 ring-gray-100"
          dangerouslySetInnerHTML={{ __html: html }}
        />
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
