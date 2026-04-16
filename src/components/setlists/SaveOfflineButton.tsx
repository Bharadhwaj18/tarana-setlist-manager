'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { parseSong } from '@/lib/chords/parser'
import { formatSong, getCss } from '@/lib/chords/formatter'
import type { Song } from '@/types'

interface SetlistSongEntry {
  song: Song
  section?: string | null
}

interface SaveOfflineButtonProps {
  setlistTitle: string
  showDate?: string | null
  venue?: string | null
  items: SetlistSongEntry[]
}

function buildOfflineHtml(
  setlistTitle: string,
  showDate: string | null | undefined,
  venue: string | null | undefined,
  items: SetlistSongEntry[]
): string {
  const chordCss = getCss()

  const dateStr = showDate
    ? new Date(showDate + 'T00:00:00').toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  // Build table of contents
  let tocHtml = '<ol class="toc-list">'
  for (const { song, section } of items) {
    const sectionLabel = section ? ` <span class="toc-section">[${section}]</span>` : ''
    tocHtml += `<li><a href="#song-${encodeURIComponent(song.id)}">${escapeHtml(song.title)}${sectionLabel}</a></li>`
  }
  tocHtml += '</ol>'

  // Build song sections
  let songsHtml = ''
  let lastSection: string | null | undefined = undefined
  let songNum = 1

  for (const { song, section } of items) {
    if (section !== lastSection) {
      if (section) {
        songsHtml += `<div class="section-divider"><span>${escapeHtml(section)}</span></div>`
      }
      lastSection = section
    }

    let chordHtml = ''
    if (song.chord_chart) {
      try {
        const parsed = parseSong(song.chord_chart)
        chordHtml = formatSong(parsed)
      } catch {
        chordHtml = `<pre class="raw-chart">${escapeHtml(song.chord_chart)}</pre>`
      }
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
        ${chordHtml
          ? `<div class="chord-sheet-wrap">${chordHtml}</div>`
          : '<p class="no-chords">No chord chart</p>'
        }
      </section>
    `
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(setlistTitle)} — Tarana</title>
  <style>
    ${chordCss}

    *, *::before, *::after { box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #fefae0;
      color: #1a1a1a;
      margin: 0;
      padding: 1rem;
      font-size: 15px;
      line-height: 1.5;
    }

    a { color: #c08d62; text-decoration: none; }
    a:hover { text-decoration: underline; }

    /* Page header */
    .page-header {
      border-bottom: 2px solid #d4a373;
      padding-bottom: 1rem;
      margin-bottom: 1.5rem;
    }
    .page-header h1 {
      margin: 0 0 0.25rem;
      font-size: 1.6rem;
      color: #1a1a1a;
    }
    .page-header .meta {
      font-size: 0.875rem;
      color: #555;
    }
    .saved-note {
      font-size: 0.75rem;
      color: #888;
      margin-top: 0.25rem;
    }

    /* Table of contents */
    .toc {
      background: #e9edc9;
      border: 1px solid #ccd5ae;
      border-radius: 8px;
      padding: 1rem 1.25rem;
      margin-bottom: 2rem;
    }
    .toc h2 {
      margin: 0 0 0.75rem;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #7a5436;
    }
    .toc-list {
      margin: 0;
      padding-left: 1.25rem;
      list-style: decimal;
    }
    .toc-list li {
      padding: 0.2rem 0;
      font-size: 0.9rem;
    }
    .toc-section {
      color: #888;
      font-size: 0.8em;
    }

    /* Section dividers */
    .section-divider {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin: 2rem 0 1rem;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #c08d62;
    }
    .section-divider::before,
    .section-divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #ccd5ae;
    }

    /* Song section */
    .song-section {
      background: #fff;
      border: 1px solid #ccd5ae;
      border-radius: 10px;
      padding: 1.25rem;
      margin-bottom: 1.5rem;
      page-break-inside: avoid;
    }
    .song-header {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }
    .song-num {
      flex-shrink: 0;
      width: 2rem;
      height: 2rem;
      border-radius: 50%;
      background: #d4a373;
      color: #fff;
      font-size: 0.85rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .song-title {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 700;
      color: #1a1a1a;
    }
    .song-artist {
      margin: 0.1rem 0 0;
      font-size: 0.85rem;
      color: #666;
    }
    .song-meta {
      margin: 0.25rem 0 0;
      font-size: 0.8rem;
      color: #888;
    }
    .song-notes {
      background: #fefae0;
      border-left: 3px solid #d4a373;
      padding: 0.5rem 0.75rem;
      font-size: 0.85rem;
      color: #555;
      margin-bottom: 0.75rem;
      border-radius: 0 4px 4px 0;
    }

    /* Chord chart */
    .chord-sheet-wrap {
      font-family: 'Courier New', Courier, monospace;
      font-size: 13px;
      line-height: 1.8;
      overflow-x: auto;
    }
    .chord { color: #d4a373; font-weight: 700; }
    .paragraph { margin-bottom: 1.25rem; }
    .row { display: flex; flex-wrap: wrap; }
    .column { display: flex; flex-direction: column; margin-right: 0.2rem; }
    .comment { color: #6b7280; font-style: italic; margin-bottom: 0.5rem; }
    .section-label {
      font-weight: 600;
      color: #374151;
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.05em;
      margin-bottom: 0.25rem;
    }

    .no-chords { color: #aaa; font-size: 0.85rem; font-style: italic; margin: 0; }
    .raw-chart { font-size: 12px; overflow-x: auto; white-space: pre-wrap; color: #555; }

    @media print {
      body { background: #fff; padding: 0; }
      .song-section { border: 1px solid #ccc; }
    }
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

  <div class="toc">
    <h2>Setlist (${items.length} songs)</h2>
    ${tocHtml}
  </div>

  ${songsHtml}
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

export function SaveOfflineButton({ setlistTitle, showDate, venue, items }: SaveOfflineButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleSave = () => {
    setLoading(true)
    try {
      const html = buildOfflineHtml(setlistTitle, showDate, venue, items)
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const filename = `${setlistTitle.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-setlist.html`

      if (isIOS()) {
        // iOS Safari doesn't support <a download>, open in new tab instead
        window.open(url, '_blank')
        // Revoke after a delay to allow loading
        setTimeout(() => URL.revokeObjectURL(url), 30_000)
      } else {
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 5_000)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleSave} loading={loading}>
      <Download className="h-4 w-4" />
      Save Offline
    </Button>
  )
}
