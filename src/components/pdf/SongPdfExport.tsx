'use client'

import { useState } from 'react'
import { FileDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { parseSong } from '@/lib/chords/parser'
import { formatSong, getCss } from '@/lib/chords/formatter'
import { useToast } from '@/components/ui/Toaster'
import type { Song } from '@/types'

function escapeHtml(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildSongPrintHtml(song: Song): string {
  let chordHtml = ''
  if (song.chord_chart) {
    try {
      chordHtml = formatSong(parseSong(song.chord_chart))
    } catch {
      chordHtml = `<pre style="white-space:pre-wrap">${escapeHtml(song.chord_chart)}</pre>`
    }
  }

  const meta: string[] = []
  if (song.song_key) meta.push(`Key: <strong>${escapeHtml(song.song_key)}</strong>`)
  if (song.bpm) meta.push(`${song.bpm} BPM`)
  if (song.time_signature) meta.push(escapeHtml(song.time_signature))

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${escapeHtml(song.title)}</title>
  <style>
    ${getCss()}
    * { box-sizing: border-box; }
    body { font-family: monospace; font-size: 14px; margin: 20mm; color: #111; }
    h1 { margin: 0 0 4px; font-size: 22px; }
    .artist { color: #555; margin: 0 0 6px; font-family: sans-serif; }
    .meta { font-family: sans-serif; font-size: 12px; color: #888; margin-bottom: 4px; }
    .notes { font-family: sans-serif; font-size: 12px; color: #555; font-style: italic; margin-bottom: 16px; border-left: 3px solid #d4a373; padding-left: 8px; }
    hr { border: none; border-top: 1px solid #ddd; margin: 12px 0 16px; }
    .chord { color: #c08d62; font-weight: 700; }
    .paragraph { margin-bottom: 1.25rem; }
    .row { display: flex; flex-wrap: wrap; }
    .column { display: flex; flex-direction: column; margin-right: 0.2rem; }
    .comment { color: #6b7280; font-style: italic; margin-bottom: 0.5rem; }
    .section-label { font-weight: 600; color: #374151; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em; margin-bottom: 0.25rem; }
  </style>
</head>
<body>
  <h1>${escapeHtml(song.title)}</h1>
  ${song.artist ? `<p class="artist">${escapeHtml(song.artist)}</p>` : ''}
  ${meta.length ? `<p class="meta">${meta.join(' &nbsp;·&nbsp; ')}</p>` : ''}
  ${song.notes ? `<p class="notes">${escapeHtml(song.notes)}</p>` : ''}
  <hr/>
  ${chordHtml || '<p style="color:#aaa;font-family:sans-serif">No chord chart</p>'}
  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`
}

export function SongPdfExport({ song }: { song: Song }) {
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const handleExport = () => {
    setLoading(true)
    try {
      const html = buildSongPrintHtml(song)
      const win = window.open('', '_blank')
      if (!win) {
        toast('Allow popups to export PDF', 'error')
        return
      }
      win.document.write(html)
      win.document.close()
    } catch {
      toast('PDF export failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="secondary" size="sm" loading={loading} onClick={handleExport}>
      <FileDown className="h-4 w-4" /> PDF
    </Button>
  )
}
