'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Plus, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { VisibilitySelect } from './VisibilitySelect'
import { DEFAULT_VISIBILITY, type Visibility } from '@/lib/visibility'
import { QuickTaskModal } from '@/components/tasks/QuickTaskModal'
import { addUnavailability, deleteUnavailability } from '@/actions/unavailability'
import { addCalendarEvent, deleteCalendarEvent } from '@/actions/calendar-events'
import { useToast } from '@/components/ui/Toaster'
import { parseISODate } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { externalLabel, type DayItems } from '@/lib/calendar'
import { HATCH_ROW, KIND_BAR, type CalendarKind } from './calendarStyles'
import { Select } from '@/components/ui/Select'

interface Member { id: string; name: string; isYou?: boolean }

interface RowProps {
  kind: CalendarKind
  href?: string
  children: React.ReactNode
}

/** One item of the day: a coloured bar, the content, and (for shows/tasks) a link to the thing itself. */
function Row({ kind, href, children }: RowProps) {
  const base = cn(
    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-800',
    kind === 'else' ? cn('border border-dashed border-gray-300', HATCH_ROW) : 'bg-brand-50',
    href && 'transition-colors hover:bg-brand-100'
  )
  const content = (
    <>
      <span className={cn('h-[30px] w-1.5 shrink-0 rounded-full', KIND_BAR[kind])} />
      {children}
    </>
  )
  return href ? <Link href={href} className={base}>{content}</Link> : <div className={base}>{content}</div>
}

function WorkspaceTag({ name }: { name?: string }) {
  return name ? <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-500 ring-1 ring-brand-200">{name}</span> : null
}

function RowText({ title, sub, done }: { title: string; sub?: string; done?: boolean }) {
  return (
    <div className="min-w-0 flex-1">
      <div className={cn('truncate font-bold text-gray-900', done && 'line-through opacity-60')}>{title}</div>
      {sub && <div className="truncate text-xs text-gray-500">{sub}</div>}
    </div>
  )
}

function RemoveButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="shrink-0 text-gray-400 hover:text-red-500 disabled:opacity-50" aria-label="Remove">
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )
}

const selectCls = 'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400'

interface Props {
  date: string
  items: DayItems
  members: Member[]
  boards?: { id: string; name: string }[]
  nameById: Record<string, string>
  readOnly?: boolean
  workspaceNameById?: Record<string, string>
  /** `panel` = card beside the month (desktop). `agenda` = plain list under the month (phones). Add forms open in a dialog (a bottom sheet on phones) in both. */
  layout: 'panel' | 'agenda'
  className?: string
}

export function DayDetailPanel({ date, items, members, boards = [], nameById, readOnly = false, workspaceNameById = {}, layout, className }: Props) {
  const wsLabel = (workspaceId: string | null) => (readOnly && workspaceId ? workspaceNameById[workspaceId] : undefined)
  const [mode, setMode] = useState<'unavailable' | 'event' | null>(null)
  const [unavailVisibility, setUnavailVisibility] = useState<Visibility>(DEFAULT_VISIBILITY)
  const [eventVisibility, setEventVisibility] = useState<Visibility>(DEFAULT_VISIBILITY)
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [memberId, setMemberId] = useState(members.find(m => m.isYou)?.id ?? members[0]?.id ?? '')
  const [endDate, setEndDate] = useState(date)
  const [reason, setReason] = useState('')
  const [eventTitle, setEventTitle] = useState('')
  const [eventEndDate, setEventEndDate] = useState(date)
  const [eventNotes, setEventNotes] = useState('')
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  const longDate = parseISODate(date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
  const itemCount = items.shows.length + items.tasks.length + items.unavailability.length + items.events.length + items.external.length

  const handleAddUnavailable = (e: React.FormEvent) => {
    e.preventDefault()
    if (!memberId) return
    startTransition(async () => {
      const result = await addUnavailability({ member_id: memberId, start_date: date, end_date: endDate || date, reason: reason.trim() || null, visibility: unavailVisibility })
      if (result.error) toast(result.error, 'error')
      else {
        toast('Marked unavailable', 'success')
        setMode(null)
        setReason('')
      }
    })
  }

  const handleDeleteUnavailable = (id: string) => {
    startTransition(async () => {
      const result = await deleteUnavailability(id)
      if (result.error) toast(result.error, 'error')
    })
  }

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault()
    if (!eventTitle.trim()) return
    startTransition(async () => {
      const result = await addCalendarEvent({ title: eventTitle, start_date: date, end_date: eventEndDate || date, notes: eventNotes.trim() || null, visibility: eventVisibility })
      if (result.error) toast(result.error, 'error')
      else {
        toast('Added', 'success')
        setMode(null)
        setEventTitle('')
        setEventNotes('')
      }
    })
  }

  const handleDeleteEvent = (id: string) => {
    startTransition(async () => {
      const result = await deleteCalendarEvent(id)
      if (result.error) toast(result.error, 'error')
    })
  }

  const list = (
    <div className="space-y-4">
      {itemCount === 0 && <p className="text-sm text-gray-400">Nothing on this day yet</p>}

      {items.shows.length > 0 && (
        <div className="space-y-1.5">
          <SectionLabel>Shows</SectionLabel>
          {items.shows.map(s => (
            <Row key={s.id} kind="show" href={readOnly ? undefined : `/shows/${s.id}`}>
              <RowText title={s.title} sub={s.venue ?? undefined} />
              <WorkspaceTag name={wsLabel(s.workspace_id)} />
            </Row>
          ))}
        </div>
      )}

      {items.tasks.length > 0 && (
        <div className="space-y-1.5">
          <SectionLabel>Tasks due</SectionLabel>
          {items.tasks.map(t => (
            <Row key={t.id} kind="task" href={readOnly ? undefined : `/tasks?task=${t.id}`}>
              <RowText
                title={t.title}
                sub={t.assignee_ids.length > 0 ? t.assignee_ids.map(id => nameById[id] ?? 'Someone').join(', ') : undefined}
                done={!!t.completed_at}
              />
              <WorkspaceTag name={wsLabel(t.workspace_id)} />
            </Row>
          ))}
        </div>
      )}

      {items.unavailability.length > 0 && (
        <div className="space-y-1.5">
          <SectionLabel>Unavailable</SectionLabel>
          {items.unavailability.map(u => (
            <Row key={u.id} kind="off">
              <RowText title={nameById[u.member_id] ?? 'Someone'} sub={u.reason ?? undefined} />
              <WorkspaceTag name={wsLabel(u.workspace_id)} />
              {!readOnly && <RemoveButton onClick={() => handleDeleteUnavailable(u.id)} disabled={isPending} />}
            </Row>
          ))}
        </div>
      )}

      {items.events.length > 0 && (
        <div className="space-y-1.5">
          <SectionLabel>Events</SectionLabel>
          {items.events.map(e => (
            <Row key={e.id} kind="event">
              <RowText title={e.title} sub={e.notes ?? undefined} />
              <WorkspaceTag name={wsLabel(e.workspace_id)} />
              {!readOnly && <RemoveButton onClick={() => handleDeleteEvent(e.id)} disabled={isPending} />}
            </Row>
          ))}
        </div>
      )}

      {items.external.length > 0 && (
        <div className="space-y-1.5">
          <SectionLabel>Elsewhere</SectionLabel>
          {items.external.map(x => (
            <Row key={x.key} kind="else">
              <RowText
                title={externalLabel(x, nameById)}
                sub={x.visibility === 'details' && x.detail ? x.detail : undefined}
              />
              <WorkspaceTag name={x.sourceName ?? undefined} />
            </Row>
          ))}
        </div>
      )}
    </div>
  )

  const form = mode && (
    <div className="mt-3 space-y-4">
      <div className="flex items-center gap-1.5">
        <Chip active={mode === 'unavailable'} onClick={() => setMode('unavailable')}>Unavailable</Chip>
        <Chip active={mode === 'event'} onClick={() => setMode('event')}>Event</Chip>
      </div>

      {mode === 'unavailable' ? (
        <form onSubmit={handleAddUnavailable} className="space-y-3">
          <div>
            <Label htmlFor={`unavail-member-${layout}`}>Who&apos;s unavailable</Label>
            <Select id={`unavail-member-${layout}`} className={selectCls} value={memberId} onChange={e => setMemberId(e.target.value)}>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor={`unavail-end-${layout}`}>Until</Label>
            <Input id={`unavail-end-${layout}`} type="date" className="mt-1" value={endDate} min={date} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor={`unavail-reason-${layout}`}>Reason</Label>
            <Input id={`unavail-reason-${layout}`} placeholder="Optional" className="mt-1" value={reason} onChange={e => setReason(e.target.value)} />
          </div>
          <VisibilitySelect id={`unavail-visibility-${layout}`} value={unavailVisibility} onChange={setUnavailVisibility} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setMode(null)}>Cancel</Button>
            <Button type="submit" size="sm" loading={isPending} disabled={!memberId}>Save</Button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleAddEvent} className="space-y-3">
          <div>
            <Label htmlFor={`event-title-${layout}`}>What&apos;s happening</Label>
            <Input id={`event-title-${layout}`} placeholder="Rehearsal, deadline, anything" className="mt-1" value={eventTitle} onChange={e => setEventTitle(e.target.value)} autoFocus />
          </div>
          <div>
            <Label htmlFor={`event-end-${layout}`}>Until</Label>
            <Input id={`event-end-${layout}`} type="date" className="mt-1" value={eventEndDate} min={date} onChange={e => setEventEndDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor={`event-notes-${layout}`}>Notes</Label>
            <Input id={`event-notes-${layout}`} placeholder="Optional" className="mt-1" value={eventNotes} onChange={e => setEventNotes(e.target.value)} />
          </div>
          <VisibilitySelect id={`event-visibility-${layout}`} value={eventVisibility} onChange={setEventVisibility} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setMode(null)}>Cancel</Button>
            <Button type="submit" size="sm" loading={isPending} disabled={!eventTitle.trim()}>Save</Button>
          </div>
        </form>
      )}
    </div>
  )

  const actions = readOnly ? null : (
    <div className="space-y-2">
      <Button className="w-full" onClick={() => { setEventEndDate(date); setMode('event') }}>
        <Plus className="h-4 w-4" /> Event
      </Button>
      <div className="grid grid-cols-3 gap-2">
        <Button variant="secondary" size="sm" onClick={() => { setEndDate(date); setMode('unavailable') }}>
          <Plus className="h-3.5 w-3.5" /> Away
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setTaskModalOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Task
        </Button>
        <Button variant="secondary" size="sm" asChild>
          <Link href={`/shows/new?date=${date}`}><Plus className="h-3.5 w-3.5" /> Show</Link>
        </Button>
      </div>
    </div>
  )

  const header = (
    <div className="flex items-end justify-between gap-3">
      <div>
        {layout === 'panel' && <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-600">Selected day</p>}
        <h2 className={cn('font-display font-bold text-gray-900', layout === 'panel' ? 'mt-0.5 text-2xl' : 'text-xl')}>{longDate}</h2>
      </div>
      <span className="shrink-0 pb-1 text-xs font-bold text-gray-500">{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
    </div>
  )

  return (
    <div className={cn('space-y-4', layout === 'panel' ? 'animate-fade-in rounded-2xl border border-brand-200 bg-white p-4 shadow-sm' : 'animate-fade-up', className)}>
      {header}
      {list}

      {actions}
      <Modal
        open={mode !== null}
        onOpenChange={open => { if (!open) setMode(null) }}
        title={longDate}
        className="max-w-md max-md:bottom-0 max-md:left-0 max-md:top-auto max-md:max-h-[85vh] max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-b-none max-md:rounded-t-3xl max-md:p-5 max-md:pb-8"
      >
        {form}
      </Modal>

      {!readOnly && <QuickTaskModal boards={boards} members={members} open={taskModalOpen} onOpenChange={setTaskModalOpen} dueDate={date} />}
    </div>
  )
}
