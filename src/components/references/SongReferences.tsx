'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toaster'
import { cn } from '@/lib/utils'
import { deleteSongReference, updateSongReference } from '@/actions/song-references'
import { MAX_LABEL_LENGTH, MAX_MOMENTS, SOURCE_NAMES, canPlayInApp, formatTime, parseTime, type PlayableReference } from '@/lib/song-references'
import { EmbedPlayer, type EmbedHandle } from './EmbedPlayer'
import { ReferenceSheet } from './ReferenceSheet'
import { ServiceMark } from './ServiceMark'
import type { SearchSource } from '@/lib/reference-lookup'

interface Props {
  songId: string
  references: PlayableReference[]
  canEdit: boolean
  /** Search tabs to offer in the add sheet (services whose keys are set). */
  searchSources: SearchSource[]
}

/** A song's references: each one plays right here, and its moments jump straight to that point. */
export function SongReferences({ songId, references, canEdit, searchSources }: Props) {
  const [sheet, setSheet] = useState<{ editing: PlayableReference | null } | null>(null)

  return (
    <section aria-labelledby="refs-heading" className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 id="refs-heading" className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-gray-500">
          References{references.length > 0 && ` · ${references.length}`}
        </h2>
        {canEdit && references.length > 0 && (
          <button type="button" onClick={() => setSheet({ editing: null })}
            className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-extrabold text-brand-700 hover:bg-brand-50">
            <Plus className="h-4 w-4" />Add
          </button>
        )}
      </div>

      {references.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-brand-200 p-4 text-center">
          <p className="text-sm text-gray-600">Link the version you play from Spotify or YouTube, so everyone hears the same thing.</p>
          {canEdit && (
            <button type="button" onClick={() => setSheet({ editing: null })}
              className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-extrabold text-white hover:bg-brand-700">
              <Plus className="h-4 w-4" />Add a reference
            </button>
          )}
        </div>
      ) : (
        references.map(r => (
          canPlayInApp(r.source)
            ? <ReferenceCard key={r.id} reference={r} canEdit={canEdit} onEdit={() => setSheet({ editing: r })} />
            : <OpenOutRow key={r.id} reference={r} canEdit={canEdit} onEdit={() => setSheet({ editing: r })} />
        ))
      )}

      <ReferenceSheet songId={songId} open={!!sheet} onOpenChange={o => { if (!o) setSheet(null) }} editing={sheet?.editing} searchSources={searchSources} />
    </section>
  )
}

function ReferenceCard({ reference: r, canEdit, onEdit }: { reference: PlayableReference; canEdit: boolean; onEdit: () => void }) {
  const player = useRef<EmbedHandle>(null)
  const [active, setActive] = useState<number | null>(null)
  // Where the player was when + Moment was tapped; null while not adding.
  const [adding, setAdding] = useState<number | null>(null)

  return (
    <div className="space-y-2.5 rounded-2xl border border-brand-200 bg-white p-3">
      <CardHeader reference={r} canEdit={canEdit} onEdit={onEdit} />
      <EmbedPlayer ref={player} reference={r} />
      {(r.moments.length > 0 || canEdit) && (
        <div className="flex flex-wrap gap-1.5">
          {r.moments.map((m, i) => (
            <button key={`${m.at}-${m.label}`} type="button" aria-pressed={active === i}
              onClick={() => { setActive(i); player.current?.seek(m.at) }}
              className={cn('inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-extrabold transition-colors', active === i ? 'bg-brand-600 text-white' : 'bg-brand-100 text-gray-800 hover:bg-brand-200')}>
              <span className="font-mono text-xs opacity-80">{formatTime(m.at)}</span>{m.label}
            </button>
          ))}
          {canEdit && r.moments.length < MAX_MOMENTS && adding === null && (
            <button type="button" onClick={() => setAdding(player.current?.position() ?? 0)}
              className="inline-flex min-h-9 items-center gap-1 rounded-full border border-dashed border-brand-300 px-3 text-sm font-extrabold text-gray-600 hover:bg-brand-50">
              <Plus className="h-3.5 w-3.5" />Moment
            </button>
          )}
        </div>
      )}
      {adding !== null && <QuickMoment reference={r} startAt={adding} onClose={() => setAdding(null)} />}
    </div>
  )
}

/** Add a moment right on the card. The time starts at wherever the player is now. */
function QuickMoment({ reference: r, startAt, onClose }: { reference: PlayableReference; startAt: number; onClose: () => void }) {
  const router = useRouter()
  const toast = useToast()
  const [label, setLabel] = useState('')
  const [time, setTime] = useState(formatTime(startAt))
  const [pending, startTransition] = useTransition()

  const save = () => {
    const at = parseTime(time)
    if (!label.trim() || at === null) { toast('Give the moment a name and a time like 2:41.', 'error'); return }
    startTransition(async () => {
      const res = await updateSongReference(r.id, { moments: [...r.moments, { label: label.trim(), at }] })
      if (res.error) { toast(res.error, 'error'); return }
      router.refresh()
      onClose()
    })
  }

  return (
    <form onSubmit={e => { e.preventDefault(); save() }} className="animate-fade-up flex items-center gap-2">
      <input autoFocus value={label} onChange={e => setLabel(e.target.value)} maxLength={MAX_LABEL_LENGTH} aria-label="Moment name" placeholder="Solo"
        className="min-h-10 min-w-0 flex-1 rounded-xl border border-brand-200 px-3 text-sm font-semibold focus:border-brand-400 focus:outline-none" />
      <input value={time} onChange={e => setTime(e.target.value)} aria-label="Time" inputMode="numeric"
        className="min-h-10 w-[4.5rem] rounded-xl border border-brand-200 px-2 text-center font-mono text-sm focus:border-brand-400 focus:outline-none" />
      <button type="submit" disabled={pending} className="min-h-10 rounded-xl bg-brand-600 px-3 text-sm font-extrabold text-white disabled:opacity-60">Save</button>
      <button type="button" onClick={onClose} className="min-h-10 rounded-xl px-2 text-sm font-bold text-gray-500">Cancel</button>
    </form>
  )
}

function OpenOutRow({ reference: r, canEdit, onEdit }: { reference: PlayableReference; canEdit: boolean; onEdit: () => void }) {
  return (
    <div className="flex items-center gap-1 rounded-2xl border border-brand-200 bg-white pr-1">
      <a href={r.url} target="_blank" rel="noopener noreferrer" className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-3 py-2">
        <ServiceMark source={r.source} size={28} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-extrabold text-gray-900">{r.title ?? SOURCE_NAMES[r.source]}</span>
          <span className="block truncate text-xs font-semibold text-gray-500">{r.label} · Opens in {SOURCE_NAMES[r.source]}</span>
        </span>
        <ExternalLink className="h-4 w-4 shrink-0 text-gray-400" />
      </a>
      {canEdit && <RefMenu reference={r} onEdit={onEdit} />}
    </div>
  )
}

function CardHeader({ reference: r, canEdit, onEdit }: { reference: PlayableReference; canEdit: boolean; onEdit: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-extrabold text-gray-800">{r.label}</span>
      <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-bold text-gray-500"><ServiceMark source={r.source} size={14} /><span className="truncate">{SOURCE_NAMES[r.source]}</span></span>
      <span className="flex-1" />
      {canEdit ? <RefMenu reference={r} onEdit={onEdit} /> : (
        <a href={r.url} target="_blank" rel="noopener noreferrer" aria-label={`Open in ${SOURCE_NAMES[r.source]}`}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"><ExternalLink className="h-4 w-4" /></a>
      )}
    </div>
  )
}

function RefMenu({ reference: r, onEdit }: { reference: PlayableReference; onEdit: () => void }) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [, startTransition] = useTransition()

  const remove = () => {
    setOpen(false)
    if (!window.confirm(`Remove the “${r.label}” reference?`)) return
    startTransition(async () => {
      const res = await deleteSongReference(r.id)
      if (res.error) { toast(res.error, 'error'); return }
      toast('Reference removed', 'success')
      router.refresh()
    })
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(v => !v)} aria-label="Reference options" aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700">
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="animate-menu-in absolute right-0 z-40 mt-1 w-52 overflow-hidden rounded-2xl border border-brand-200 bg-white p-1 shadow-lg">
            <button type="button" onClick={() => { setOpen(false); onEdit() }} className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-gray-700 hover:bg-brand-50"><Pencil className="h-4 w-4" />Edit label and moments</button>
            <a href={r.url} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-gray-700 hover:bg-brand-50"><ExternalLink className="h-4 w-4" />Open in {SOURCE_NAMES[r.source]}</a>
            <button type="button" onClick={remove} className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" />Remove</button>
          </div>
        </>
      )}
    </div>
  )
}
