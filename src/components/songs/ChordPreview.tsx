'use client'

import { useEffect, useMemo } from 'react'
import { parseSong } from '@/lib/chords/parser'
import { formatSong } from '@/lib/chords/formatter'
import { ensureChordSheetCss } from './chordSheetStyles'

/** Read-only rendering of a chord chart as it will look on the song page. */
export function ChordPreview({ chart }: { chart: string }) {
  useEffect(() => { ensureChordSheetCss() }, [])
  const html = useMemo(() => (chart.trim() ? formatSong(parseSong(chart)) : ''), [chart])

  return (
    <div className="flex h-full min-h-48 flex-col overflow-hidden rounded-xl border border-brand-200 bg-white">
      <div className="border-b border-brand-200 bg-gray-50 px-3 py-2 text-xs font-extrabold uppercase tracking-[0.1em] text-gray-500">
        Live preview
      </div>
      {html ? (
        <div className="chord-view max-h-[28rem] flex-1 overflow-auto p-4" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <p className="p-4 text-sm text-gray-400">Start typing a chord chart and it appears here.</p>
      )}
    </div>
  )
}
