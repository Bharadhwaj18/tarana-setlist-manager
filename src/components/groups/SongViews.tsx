'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, ListMusic, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toaster'
import { cn } from '@/lib/utils'
import { saveGroupNotes } from '@/actions/groups'
import { MAX_GROUP_NOTES, type WorkspaceGroup } from '@/lib/groups'
import { GroupTag } from './GroupsSettings'

export interface NoteView {
  content: string
  updatedByName: string | null
  updatedAt: string
}

interface Props {
  songId: string
  groups: WorkspaceGroup[]
  /** Groups the viewer is in. They get a tab each, opening on the first. */
  myGroupIds: string[]
  /** Owners and admins can preview any group's view. */
  isAdmin: boolean
  canEditSongs: boolean
  notes: Record<string, NoteView>
  /** The chord chart, rendered by the page. Kept mounted while hidden so its transpose survives a tab switch. */
  chart: ReactNode
}

const CHART = 'chart'

/** A song as each group sees it: the chord chart, or the group's own notes for this song. */
export function SongViews({ songId, groups, myGroupIds, isAdmin, canEditSongs, notes, chart }: Props) {
  const mine = groups.filter(g => myGroupIds.includes(g.id))
  const others = isAdmin ? groups.filter(g => !myGroupIds.includes(g.id)) : []
  const [view, setView] = useState<string>(mine[0]?.id ?? CHART)
  const active = groups.find(g => g.id === view) ?? null
  const showChart = !active || active.sees === 'chart'

  // No groups for this person to see: the song looks as it always has.
  if (!mine.length && !others.length) return <>{chart}</>

  return (
    <div className="min-w-0 space-y-3">
      {mine.length > 0 && (
        <div role="tablist" aria-label="View" className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl bg-brand-100/70 p-1">
          {[...mine, null].map(g => {
            const id = g?.id ?? CHART
            const on = view === id
            return (
              <button key={id} type="button" role="tab" aria-selected={on} onClick={() => setView(id)}
                className={cn('flex min-h-10 flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-extrabold', on ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600')}>
                {g ? <span aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ background: g.color }} /> : <ListMusic className="h-4 w-4" />}
                {g ? g.name : 'Full chart'}
              </button>
            )
          })}
        </div>
      )}

      {others.length > 0 && (
        <label className="flex items-center gap-2 rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm">
          <Eye className="h-4 w-4 shrink-0 text-gray-500" />
          <span className="flex-1 font-semibold text-gray-600">Preview as</span>
          <Select value={others.some(g => g.id === view) ? view : ''} onChange={e => setView(e.target.value || (mine[0]?.id ?? CHART))}
            className="max-w-[55%] rounded-lg border border-brand-200 bg-white px-2 py-1 text-sm font-extrabold text-gray-900">
            <option value="">{mine.length ? 'Your view' : 'Full chart'}</option>
            {others.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
        </label>
      )}

      {active?.sees === 'notes' && (
        <GroupNotes key={active.id} songId={songId} group={active} note={notes[active.id]}
          canEdit={canEditSongs || myGroupIds.includes(active.id)} onShowChart={() => setView(CHART)} />
      )}

      <div hidden={!showChart}>{chart}</div>
    </div>
  )
}

function GroupNotes({ songId, group, note, canEdit, onShowChart }: {
  songId: string
  group: WorkspaceGroup
  note: NoteView | undefined
  canEdit: boolean
  onShowChart: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [pending, startTransition] = useTransition()
  const hasNotes = !!note?.content.trim()

  const startEditing = () => { setDraft(note?.content ?? ''); setEditing(true) }
  const save = () => startTransition(async () => {
    const res = await saveGroupNotes(songId, group.id, draft)
    if (res.error) { toast(res.error, 'error'); return }
    toast(`${group.name} notes saved`, 'success')
    setEditing(false)
    router.refresh()
  })

  const chartLink = (
    <button type="button" onClick={onShowChart} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-1 text-sm font-bold text-brand-700 hover:underline">
      <ListMusic className="h-4 w-4" />Show the chord chart
    </button>
  )

  if (editing) {
    return (
      <div className="animate-fade-in space-y-3 rounded-2xl border border-brand-200 bg-white p-3">
        <div className="flex items-center justify-between"><GroupTag group={group} /><span className="text-xs font-semibold text-gray-500">Everyone in {group.name} sees this</span></div>
        <textarea autoFocus value={draft} onChange={e => setDraft(e.target.value)} maxLength={MAX_GROUP_NOTES} aria-label={`${group.name} notes`}
          placeholder={'Write it section by section, e.g.\nIntro  : 4 bars, rim click\nVerse  : half-time feel\nChorus : open hat on 2 and 4'}
          className="min-h-[240px] w-full resize-y rounded-xl border border-brand-200 bg-white p-3 font-mono text-[13px] leading-relaxed text-gray-900 placeholder-gray-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/30" />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
          <Button type="button" onClick={save} loading={pending}>Save notes</Button>
        </div>
      </div>
    )
  }

  if (!hasNotes) {
    return (
      <div className="space-y-2">
        <div className="flex flex-col items-center gap-2.5 rounded-2xl border-2 border-dashed border-brand-200 px-4 py-6 text-center">
          <GroupTag group={group} />
          <p className="font-extrabold text-gray-900">No {group.name} notes for this song yet</p>
          <p className="max-w-xs text-sm text-gray-500">
            {canEdit ? `Write what ${group.name} plays or sings, section by section. Everyone in ${group.name} will see it here.` : `Someone in ${group.name} can add them.`}
          </p>
          {canEdit && (
            <button type="button" onClick={startEditing} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-extrabold text-white hover:bg-brand-700">
              <Plus className="h-4 w-4" />Write the {group.name} notes
            </button>
          )}
        </div>
        {chartLink}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="animate-fade-in space-y-3 rounded-2xl border border-brand-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <GroupTag group={group} />
          <span className="min-w-0 flex-1 truncate text-right text-xs font-semibold text-gray-500">
            {note?.updatedByName ? `Edited by ${note.updatedByName} · ` : ''}{new Date(note!.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}
          </span>
          {canEdit && (
            <button type="button" onClick={startEditing} aria-label={`Edit the ${group.name} notes`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-brand-50 hover:text-gray-800">
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="whitespace-pre-wrap break-words font-mono text-[14px] leading-7 text-gray-900">{note!.content}</p>
      </div>
      {chartLink}
    </div>
  )
}
