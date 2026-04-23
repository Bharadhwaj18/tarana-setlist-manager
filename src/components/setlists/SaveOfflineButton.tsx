'use client'

import { useState, useEffect } from 'react'
import { WifiOff, CloudOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { parseSong } from '@/lib/chords/parser'
import { formatSong, getCss } from '@/lib/chords/formatter'
import { saveSetlistOffline, removeSetlistOffline, isSetlistSavedOffline } from '@/lib/offline'
import { useToast } from '@/components/ui/Toaster'
import type { Song } from '@/types'

interface SetlistSongEntry {
  song: Song
  section?: string | null
}

interface SaveOfflineButtonProps {
  setlistId: string
  setlistTitle: string
  showDate?: string | null
  venue?: string | null
  items: SetlistSongEntry[]
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildOfflineHtml(
  setlistTitle: string,
  showDate: string | null | undefined,
  venue: string | null | undefined,
  items: SetlistSongEntry[]
): string {
  const chordCss = getCss()
  const dateStr = showDate
    ? new Date(showDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  let tocHtml = '<ol class="toc-list">'
  for (const { song, section } of items) {
    const sectionLabel = section ? ` <span class="toc-section">[${section}]</span>` : ''
    tocHtml += `<li><a href="#song-${encodeURIComponent(song.id)}">${escapeHtml(song.title)}${sectionLabel}</a></li>`
  }
  tocHtml += '</ol>'

  let songsHtml = ''
  let lastSection: string | null | undefined = undefined
  let songNum = 1
  for (const { song, section } of items) {
    if (section !== lastSection) {
      if (section) songsHtml += `<div class="section-divider"><span>${escapeHtml(section)}</span></div>`
      lastSection = section
    }
    let chordHtml = ''
    if (song.chord_chart) {
      try { chordHtml = formatSong(parseSong(song.chord_chart)) } catch { chordHtml = `<pre class="raw-chart">${escapeHtml(song.chord_chart)}</pre>` }
    }
    const meta: string[] = []
    if (song.song_key) meta.push(`Key: <strong>${escapeHtml(song.song_key)}</strong>`)
    if (song.bpm) meta.push(`${song.bpm} BPM`)
    if (song.time_signature) meta.push(escapeHtml(song.time_signature))
    songsHtml += `
      <section class="song-section" id="song-${encodeURIComponent(song.id)}">
        <div class="song-header">
          <div class="song-num">${songNum++}</div>
          <div>
            <h2 class="song-title">${escapeHtml(song.title)}</h2>
            ${song.artist ? `<p class="song-artist">${escapeHtml(song.artist)}</p>` : ''}
            ${meta.length ? `<p class="song-meta">${meta.join(' &nbsp;·&nbsp; ')}</p>` : ''}
          </div>
        </div>
        ${song.notes ? `<div class="song-notes">${escapeHtml(song.notes)}</div>` : ''}
        ${chordHtml ? `<div class="chord-sheet-wrap">${chordHtml}</div>` : '<p class="no-chords">No chord chart</p>'}
      </section>`
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(setlistTitle)} — Tarana</title>
  <style>
    ${chordCss}
    *,*::before,*::after{box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fefae0;color:#1a1a1a;margin:0;padding:1rem;font-size:15px;line-height:1.5}
    a{color:#c08d62;text-decoration:none}a:hover{text-decoration:underline}
    .page-header{border-bottom:2px solid #d4a373;padding-bottom:1rem;margin-bottom:1.5rem}
    .page-header h1{margin:0 0 .25rem;font-size:1.6rem}
    .page-header .meta{font-size:.875rem;color:#555}
    .saved-note{font-size:.75rem;color:#888;margin-top:.25rem}
    .toc{background:#e9edc9;border:1px solid #ccd5ae;border-radius:8px;padding:1rem 1.25rem;margin-bottom:2rem}
    .toc h2{margin:0 0 .75rem;font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;color:#7a5436}
    .toc-list{margin:0;padding-left:1.25rem;list-style:decimal}
    .toc-list li{padding:.2rem 0;font-size:.9rem}
    .toc-section{color:#888;font-size:.8em}
    .section-divider{display:flex;align-items:center;gap:.75rem;margin:2rem 0 1rem;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#c08d62}
    .section-divider::before,.section-divider::after{content:'';flex:1;height:1px;background:#ccd5ae}
    .song-section{background:#fff;border:1px solid #ccd5ae;border-radius:10px;padding:1.25rem;margin-bottom:1.5rem}
    .song-header{display:flex;align-items:flex-start;gap:.75rem;margin-bottom:.75rem}
    .song-num{flex-shrink:0;width:2rem;height:2rem;border-radius:50%;background:#d4a373;color:#fff;font-size:.85rem;font-weight:700;display:flex;align-items:center;justify-content:center}
    .song-title{margin:0;font-size:1.1rem;font-weight:700}
    .song-artist{margin:.1rem 0 0;font-size:.85rem;color:#666}
    .song-meta{margin:.25rem 0 0;font-size:.8rem;color:#888}
    .song-notes{background:#fefae0;border-left:3px solid #d4a373;padding:.5rem .75rem;font-size:.85rem;color:#555;margin-bottom:.75rem;border-radius:0 4px 4px 0}
    .chord-sheet-wrap{font-family:'Courier New',monospace;font-size:13px;line-height:1.8;overflow-x:auto}
    .chord{color:#d4a373;font-weight:700}.paragraph{margin-bottom:1.25rem}
    .row{display:flex;flex-wrap:wrap}.column{display:flex;flex-direction:column;margin-right:.2rem}
    .comment{color:#6b7280;font-style:italic;margin-bottom:.5rem}
    .section-label{font-weight:600;color:#374151;text-transform:uppercase;font-size:.75rem;letter-spacing:.05em;margin-bottom:.25rem}
    .no-chords{color:#aaa;font-size:.85rem;font-style:italic;margin:0}
    .raw-chart{font-size:12px;overflow-x:auto;white-space:pre-wrap;color:#555}
  </style>
</head>
<body>
  <div class="page-header">
    <h1>${escapeHtml(setlistTitle)}</h1>
    <div class="meta">
      ${dateStr ? `<span>📅 ${dateStr}</span>` : ''}
      ${venue ? `${dateStr ? ' &nbsp;·&nbsp; ' : ''}<span>📍 ${escapeHtml(venue)}</span>` : ''}
    </div>
    <div class="saved-note">Saved offline — ${new Date().toLocaleString()}</div>
  </div>
  <div class="toc"><h2>Setlist (${items.length} songs)</h2>${tocHtml}</div>
  ${songsHtml}
</body>
</html>`
}

export function SaveOfflineButton({ setlistId, setlistTitle, showDate, venue, items }: SaveOfflineButtonProps) {
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => {
    setSaved(isSetlistSavedOffline(setlistId))
  }, [setlistId])

  const handleSave = async () => {
    setSaving(true)
    try {
      const html = buildOfflineHtml(setlistTitle, showDate, venue, items)
      const songMetas = items.map(({ song }) => ({
        id: song.id,
        title: song.title,
        artist: song.artist ?? null,
        song_key: song.song_key ?? null,
        setlistId,
        setlistTitle,
      }))
      await saveSetlistOffline(setlistId, setlistTitle, html, songMetas)
      setSaved(true)
      toast('Setlist saved for offline use', 'success')
    } catch {
      toast('Failed to save offline', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    await removeSetlistOffline(setlistId)
    setSaved(false)
    toast('Removed from offline storage', 'success')
  }

  if (saved) {
    return (
      <div className="flex items-center gap-2 rounded-full bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700 ring-1 ring-green-200">
        <WifiOff className="h-3.5 w-3.5 shrink-0" />
        <span>Saved offline</span>
        <button
          onClick={handleRemove}
          className="ml-1 text-green-500 hover:text-green-800 underline underline-offset-2"
        >
          Remove
        </button>
      </div>
    )
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleSave} disabled={saving}>
      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudOff className="h-4 w-4" />}
      {saving ? 'Saving…' : 'Save offline'}
    </Button>
  )
}
