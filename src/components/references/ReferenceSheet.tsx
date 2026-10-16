'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ExternalLink, Link2, Plus, Search, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toaster'
import { cn } from '@/lib/utils'
import { addSongReference, previewReference, searchReferences, updateSongReference } from '@/actions/song-references'
import type { ReferenceDetails, SearchResult, SearchSource } from '@/lib/reference-lookup'
import { MAX_LABEL_LENGTH, MAX_MOMENTS, REFERENCE_LABELS, SOURCE_NAMES, formatTime, parseTime, type Moment, type PlayableReference } from '@/lib/song-references'
import { ServiceMark } from './ServiceMark'
import { Cover } from './Cover'

interface Props {
  songId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Set to edit a saved reference's label and moments; the link itself stays. */
  editing?: PlayableReference | null
  /** Search tabs to offer, only for services whose keys are set. Empty: paste a link only. */
  searchSources: SearchSource[]
}

/** Add a reference by pasting a link or searching YouTube / Spotify, or edit one's label and moments. */
export function ReferenceSheet({ songId, open, onOpenChange, editing, searchSources }: Props) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={editing ? 'Edit reference' : 'Add a reference'} className="max-w-[480px] rounded-2xl">
      {/* Mounted only while open, so every opening starts fresh. */}
      {open && <ReferenceForm songId={songId} editing={editing ?? null} searchSources={searchSources} onDone={() => onOpenChange(false)} />}
    </Modal>
  )
}

interface DraftMoment { key: number; label: string; time: string }
type Mode = 'link' | SearchSource

const eyebrow = 'text-[11px] font-extrabold uppercase tracking-[0.12em] text-gray-500'
const field = 'w-full rounded-xl border border-brand-200 bg-white px-3 text-[15px] text-gray-900 placeholder-gray-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/30'

function ReferenceForm({ songId, editing, searchSources, onDone }: { songId: string; editing: PlayableReference | null; searchSources: SearchSource[]; onDone: () => void }) {
  const router = useRouter()
  const toast = useToast()
  const [mode, setMode] = useState<Mode>('link')
  const [link, setLink] = useState('')
  const [details, setDetails] = useState<ReferenceDetails | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [looking, setLooking] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searchNote, setSearchNote] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [label, setLabel] = useState(editing?.label ?? 'Original')
  const [ownLabel, setOwnLabel] = useState(!!editing && !(REFERENCE_LABELS as readonly string[]).includes(editing.label))
  const [moments, setMoments] = useState<DraftMoment[]>(() => (editing?.moments ?? []).map((m, i) => ({ key: i, label: m.label, time: formatTime(m.at) })))
  const [saving, startSaving] = useTransition()
  const nextKey = useRef(moments.length)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Only the newest lookup or search may land, so a slow older answer can't overwrite a newer one.
  const latest = useRef(0)

  const switchMode = (next: Mode) => {
    clearTimeout(timer.current)
    latest.current++
    setMode(next)
    setQuery('')
    setResults([])
    setSearchNote(null)
    setSearching(false)
  }

  const onLinkChange = (value: string) => {
    setLink(value)
    setDetails(null)
    setLookupError(null)
    clearTimeout(timer.current)
    if (!value.trim()) return
    const ticket = ++latest.current
    timer.current = setTimeout(async () => {
      setLooking(true)
      const res = await previewReference(value)
      if (ticket !== latest.current) return
      setLooking(false)
      if (res.details) setDetails(res.details)
      else setLookupError(res.error ?? null)
    }, 400)
  }

  const onQueryChange = (value: string) => {
    if (mode === 'link') return
    const source = mode
    setQuery(value)
    clearTimeout(timer.current)
    if (value.trim().length < 2) { setResults([]); return }
    const ticket = ++latest.current
    // A longer pause than the link lookup: each YouTube search uses up part of a daily allowance.
    timer.current = setTimeout(async () => {
      setSearching(true)
      const res = await searchReferences(source, value)
      if (ticket !== latest.current) return
      setSearching(false)
      setResults(res.results ?? [])
      setSearchNote(res.error ?? null)
    }, 600)
  }

  const pick = (r: SearchResult) => {
    setLink(r.url)
    setDetails({ source: r.source, url: r.url, externalId: r.id, title: r.title, artist: r.artist, album: r.album, thumbnailUrl: r.thumbnailUrl, durationMs: r.durationMs })
  }

  const addMoment = () => {
    if (moments.length >= MAX_MOMENTS) return
    setMoments(m => [...m, { key: nextKey.current++, label: '', time: '' }])
  }
  const setMoment = (key: number, patch: Partial<DraftMoment>) => setMoments(list => list.map(m => (m.key === key ? { ...m, ...patch } : m)))

  const submit = () => {
    const parsed: Moment[] = []
    for (const m of moments) {
      if (!m.label.trim() && !m.time.trim()) continue
      const at = parseTime(m.time)
      if (!m.label.trim() || at === null) {
        toast('Give each moment a name and a time like 2:41.', 'error')
        return
      }
      parsed.push({ label: m.label.trim(), at })
    }
    if (!label.trim()) { toast('Give the reference a label, like Original.', 'error'); return }
    startSaving(async () => {
      const res = editing
        ? await updateSongReference(editing.id, { label, moments: parsed })
        : await addSongReference({ songId, link: details?.url ?? link, label, moments: parsed })
      if (res.error) { toast(res.error, 'error'); return }
      toast(editing ? 'Reference saved' : 'Reference added', 'success')
      router.refresh()
      onDone()
    })
  }

  const tabs: [Mode, string][] = [['link', 'Paste a link'], ...searchSources.map(s => [s, SOURCE_NAMES[s]] as [Mode, string])]

  return (
    <div className="space-y-5">
      {!editing && tabs.length > 1 && (
        <div role="tablist" aria-label="How to add" className="flex rounded-xl bg-brand-100/70 p-1">
          {tabs.map(([key, text]) => (
            <button key={key} type="button" role="tab" aria-selected={mode === key} onClick={() => switchMode(key)}
              className={cn('flex min-h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-1 text-sm font-extrabold', mode === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600')}>
              {key === 'link' ? <Link2 className="h-4 w-4 shrink-0" /> : <ServiceMark source={key} size={16} />}
              <span className="truncate">{text}</span>
            </button>
          ))}
        </div>
      )}

      {editing ? (
        <Found title={editing.title ?? 'Reference'} sub={editing.artist ?? ''} thumbnailUrl={editing.thumbnailUrl} source={editing.source} url={editing.url} />
      ) : mode === 'link' ? (
        <div className="space-y-2">
          <div className="relative">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input autoFocus value={link} onChange={e => onLinkChange(e.target.value)} inputMode="url" aria-label="Song link"
              placeholder="Paste a Spotify or YouTube link" className={cn(field, 'min-h-12 pl-9')} />
          </div>
          {looking && <p className="text-sm text-gray-500">Looking it up…</p>}
          {details && <Found title={details.title ?? 'Song'} sub={[details.artist, details.album, details.durationMs ? formatTime(details.durationMs / 1000) : null].filter(Boolean).join(' · ')} thumbnailUrl={details.thumbnailUrl} source={details.source} url={details.url} />}
          {lookupError && <p className="text-sm font-semibold text-red-700">{lookupError}</p>}
          {!details && !lookupError && !looking && <p className="text-xs text-gray-500">Works with Spotify, YouTube, YouTube Music, Apple Music and SoundCloud links.</p>}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input autoFocus value={query} onChange={e => onQueryChange(e.target.value)} type="search" aria-label={`Search ${SOURCE_NAMES[mode]}`}
              placeholder="Song and artist" className={cn(field, 'min-h-12 pl-9')} />
          </div>
          {searchNote && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">{searchNote}</p>}
          {searching && results.length === 0 && <p className="text-sm text-gray-500">Searching {SOURCE_NAMES[mode]}…</p>}
          <div className="max-h-64 space-y-0.5 overflow-y-auto">
            {results.map(r => {
              const picked = details?.externalId === r.id
              return (
                <div key={r.id} className={cn('flex items-center gap-1 rounded-xl', picked ? 'bg-brand-100 ring-2 ring-brand-400' : 'hover:bg-brand-50')}>
                  <button type="button" aria-pressed={picked} onClick={() => pick(r)} className="flex min-h-[60px] min-w-0 flex-1 items-center gap-3 px-2 text-left">
                    <Cover url={r.thumbnailUrl} title={r.title} size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold text-gray-900">{r.title}</span>
                      <span className="block truncate text-xs font-semibold text-gray-500">{[r.artist, r.album].filter(Boolean).join(' · ')}</span>
                    </span>
                    {r.durationMs !== null && <span className="font-mono text-xs text-gray-400">{formatTime(r.durationMs / 1000)}</span>}
                    <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', picked ? 'bg-brand-600 text-white' : 'border border-brand-200 text-gray-500')}>
                      {picked ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </span>
                  </button>
                  <a href={r.url} target="_blank" rel="noopener noreferrer" aria-label={`Open “${r.title}” in ${SOURCE_NAMES[r.source]}`}
                    className="flex h-10 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:text-gray-700">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              )
            })}
          </div>
          {results.length > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-gray-500">
              <ServiceMark source={mode} size={14} />Results from {SOURCE_NAMES[mode]}. Picking one also fills an empty {mode === 'spotify' ? 'artist and cover' : 'cover'}.
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <p className={eyebrow}>What is it?</p>
        <div className="flex flex-wrap gap-1.5">
          {REFERENCE_LABELS.map(l => (
            <button key={l} type="button" aria-pressed={!ownLabel && label === l} onClick={() => { setOwnLabel(false); setLabel(l) }}
              className={cn('min-h-9 rounded-full px-3 text-sm font-extrabold', !ownLabel && label === l ? 'bg-brand-600 text-white' : 'bg-brand-100 text-gray-800 hover:bg-brand-200')}>
              {l}
            </button>
          ))}
          <button type="button" aria-pressed={ownLabel} onClick={() => { setOwnLabel(true); setLabel(ownLabel ? label : '') }}
            className={cn('inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-sm font-extrabold', ownLabel ? 'bg-brand-600 text-white' : 'border border-dashed border-brand-300 text-gray-600')}>
            <Plus className="h-3.5 w-3.5" />Your own
          </button>
        </div>
        {ownLabel && (
          <input autoFocus value={label} maxLength={MAX_LABEL_LENGTH} onChange={e => setLabel(e.target.value)} aria-label="Label"
            placeholder="e.g. Acoustic version" className={cn(field, 'min-h-11')} />
        )}
      </div>

      <div className="space-y-2">
        <p className={eyebrow}>Moments <span className="font-semibold normal-case tracking-normal text-gray-400">· optional</span></p>
        {moments.map(m => (
          <div key={m.key} className="flex items-center gap-2">
            <input value={m.label} onChange={e => setMoment(m.key, { label: e.target.value })} aria-label="Moment name" maxLength={MAX_LABEL_LENGTH}
              placeholder="Solo" className={cn(field, 'min-h-11 min-w-0 flex-1 font-semibold')} />
            <input value={m.time} onChange={e => setMoment(m.key, { time: e.target.value })} aria-label="Time" inputMode="numeric"
              placeholder="2:41" className={cn(field, 'min-h-11 w-20 text-center font-mono')} />
            <button type="button" onClick={() => setMoments(list => list.filter(x => x.key !== m.key))} aria-label="Remove moment"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        {moments.length < MAX_MOMENTS && (
          <button type="button" onClick={addMoment}
            className="inline-flex min-h-9 items-center gap-1 rounded-full border border-dashed border-brand-300 px-3 text-sm font-extrabold text-gray-600 hover:bg-brand-50">
            <Plus className="h-3.5 w-3.5" />Add a moment
          </button>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="secondary" onClick={onDone}>Cancel</Button>
        <Button type="button" onClick={submit} loading={saving} disabled={!editing && !details}>{editing ? 'Save' : 'Add reference'}</Button>
      </div>
    </div>
  )
}

/** The matched song, with a link back to where its details and artwork came from. */
function Found({ title, sub, thumbnailUrl, source, url }: { title: string; sub: string; thumbnailUrl: string | null; source: ReferenceDetails['source']; url: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-2.5">
      <Cover url={thumbnailUrl} title={title} size={48} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-extrabold text-gray-900">{title}</span>
        {sub && <span className="block truncate text-xs font-semibold text-gray-500">{sub}</span>}
      </span>
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-extrabold text-emerald-800 hover:bg-emerald-100">
        <ServiceMark source={source} size={16} />Open
      </a>
    </div>
  )
}
