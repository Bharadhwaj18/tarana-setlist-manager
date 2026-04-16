'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { parseSong } from '@/lib/chords/parser'
import { formatSong, getCss } from '@/lib/chords/formatter'
import { transposeSong } from '@/lib/chords/transposer'
import { Button } from '@/components/ui/Button'
import type { Song } from 'chordsheetjs'

interface ChordViewerProps {
  chordChart: string
  songKey?: string | null
  printRef?: React.RefObject<HTMLDivElement | null>
}

export function ChordViewer({ chordChart, printRef }: ChordViewerProps) {
  const [song, setSong] = useState<Song>(() => parseSong(chordChart))
  const [semitones, setSemitones] = useState(0)
  const [cssInjected, setCssInjected] = useState(false)
  const internalRef = useRef<HTMLDivElement>(null)

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

  const html = formatSong(song)

  const viewer = (
    <div
      ref={printRef ?? internalRef}
      className="rounded-lg bg-white p-6 ring-1 ring-gray-100"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )

  if (!chordChart) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400">
        No chord chart added yet. Edit the song to add chords.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Transpose controls */}
      <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5">
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
        {semitones !== 0 && (
          <Button variant="ghost" size="sm" onClick={() => { setSong(parseSong(chordChart)); setSemitones(0) }}>
            Reset
          </Button>
        )}
      </div>

      {viewer}
    </div>
  )
}
