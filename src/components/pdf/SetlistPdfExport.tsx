'use client'

import { useState } from 'react'
import { FileDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toaster'
import type { Setlist, Song } from '@/types'

function escapeHtml(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildSetlistPrintHtml(setlist: Setlist, songs: Song[]): string {
  const date = setlist.show_date
    ? new Date(setlist.show_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const rows = songs.map((song, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${escapeHtml(song.title)}</strong></td>
      <td>${song.artist ? escapeHtml(song.artist) : '—'}</td>
      <td>${song.song_key ? escapeHtml(song.song_key) : '—'}</td>
      <td>${song.bpm ?? '—'}</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${escapeHtml(setlist.title)} — Setlist</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: sans-serif; font-size: 14px; margin: 20mm; color: #111; }
    h1 { margin: 0 0 4px; font-size: 22px; }
    .meta { color: #6b7280; font-size: 13px; margin-bottom: 4px; }
    .notes { color: #6b7280; font-size: 12px; font-style: italic; margin-bottom: 20px; }
    hr { border: none; border-top: 2px solid #d4a373; margin: 12px 0 20px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af; padding: 8px 6px; border-bottom: 2px solid #e5e7eb; }
    td { padding: 10px 6px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
    td:first-child { color: #9ca3af; width: 32px; }
    .key { font-weight: 700; color: #c08d62; }
    .footer { margin-top: 24px; font-size: 11px; color: #d1d5db; text-align: right; }
  </style>
</head>
<body>
  <h1>${escapeHtml(setlist.title)}</h1>
  ${date || setlist.venue ? `<p class="meta">${[date, setlist.venue ? escapeHtml(setlist.venue) : ''].filter(Boolean).join(' · ')}</p>` : ''}
  ${setlist.notes ? `<p class="notes">${escapeHtml(setlist.notes)}</p>` : ''}
  <hr/>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Title</th><th>Artist</th><th>Key</th><th>BPM</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="footer">Tarana Setlist Manager</p>
  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`
}

export function SetlistPdfExport({ setlist, songs }: { setlist: Setlist; songs: Song[] }) {
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const handleExport = () => {
    setLoading(true)
    try {
      const html = buildSetlistPrintHtml(setlist, songs)
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
