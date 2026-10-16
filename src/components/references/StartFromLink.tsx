'use client'

import { useRef, useState } from 'react'
import { Link2 } from 'lucide-react'
import { previewReference } from '@/actions/song-references'
import type { ReferenceDetails } from '@/lib/reference-lookup'
import { SOURCE_NAMES, formatTime } from '@/lib/song-references'
import { ServiceMark } from './ServiceMark'
import { Cover } from './Cover'

/**
 * "Start from a link" on New song: paste a Spotify or YouTube link and the form fills itself in.
 * The link is then saved as the song's Original reference.
 */
export function StartFromLink({ onFound }: { onFound: (details: ReferenceDetails | null) => void }) {
  const [link, setLink] = useState('')
  const [details, setDetails] = useState<ReferenceDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [looking, setLooking] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const latest = useRef(0)

  const onChange = (value: string) => {
    setLink(value)
    setDetails(null)
    setError(null)
    onFound(null)
    clearTimeout(timer.current)
    if (!value.trim()) return
    const ticket = ++latest.current
    timer.current = setTimeout(async () => {
      setLooking(true)
      const res = await previewReference(value)
      if (ticket !== latest.current) return
      setLooking(false)
      setDetails(res.details ?? null)
      setError(res.error ?? null)
      onFound(res.details ?? null)
    }, 400)
  }

  return (
    <div className="space-y-2.5 rounded-2xl border border-brand-200 bg-white p-4">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-gray-500">Start from a link</p>
      <div className="relative">
        <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input value={link} onChange={e => onChange(e.target.value)} inputMode="url" aria-label="Spotify or YouTube link"
          placeholder="Paste a Spotify or YouTube link (optional)"
          className="min-h-12 w-full rounded-xl border border-brand-200 bg-white pl-9 pr-3 text-[15px] text-gray-900 placeholder-gray-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/30" />
      </div>
      {looking && <p className="text-sm text-gray-500">Looking it up…</p>}
      {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
      {details && (
        <>
          <div className="animate-fade-up flex items-center gap-3 rounded-xl bg-emerald-50 p-2.5">
            <Cover url={details.thumbnailUrl} title={details.title ?? 'Song'} size={48} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-extrabold text-gray-900">{details.title ?? 'Song'}</span>
              <span className="block truncate text-xs font-semibold text-gray-500">
                {[details.artist, details.album, details.durationMs ? formatTime(details.durationMs / 1000) : null].filter(Boolean).join(' · ')}
              </span>
            </span>
            <a href={details.url} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-extrabold text-emerald-800 hover:bg-emerald-100"><ServiceMark source={details.source} size={16} />Open</a>
          </div>
          <p className="text-xs text-gray-500">Saved as this song’s Original reference{details.thumbnailUrl ? ', with its cover' : ''}.</p>
          {details.source === 'spotify' && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">{SOURCE_NAMES.spotify} doesn’t share a song’s key or BPM, so add those yourself.</p>
          )}
        </>
      )}
    </div>
  )
}
