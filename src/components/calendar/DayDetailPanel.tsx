'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Plus, Trash2, CalendarDays, StickyNote, UserX, Tag } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { NoteModal } from '@/components/notes/NoteModal'
import { addUnavailability, deleteUnavailability } from '@/actions/unavailability'
import { addCalendarEvent, deleteCalendarEvent } from '@/actions/calendar-events'
import { useToast } from '@/components/ui/Toaster'
import { parseISODate } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { DayItems } from '@/lib/calendar'

interface Member { id: string; name: string }

interface Props {
  date: string
  items: DayItems
  members: Member[]
  nameById: Record<string, string>
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DayDetailPanel({ date, items, members, nameById, open, onOpenChange }: Props) {
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [addingUnavailable, setAddingUnavailable] = useState(false)
  const [memberId, setMemberId] = useState(members[0]?.id ?? '')
  const [endDate, setEndDate] = useState(date)
  const [reason, setReason] = useState('')
  const [addingEvent, setAddingEvent] = useState(false)
  const [eventTitle, setEventTitle] = useState('')
  const [eventEndDate, setEventEndDate] = useState(date)
  const [eventNotes, setEventNotes] = useState('')
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  const title = parseISODate(date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const hasAnything = items.shows.length > 0 || items.tasks.length > 0 || items.unavailability.length > 0 || items.events.length > 0

  const handleAddUnavailable = (e: React.FormEvent) => {
    e.preventDefault()
    if (!memberId) return
    startTransition(async () => {
      const result = await addUnavailability({ member_id: memberId, start_date: date, end_date: endDate || date, reason: reason.trim() || null })
      if (result.error) toast(result.error, 'error')
      else {
        toast('Marked unavailable', 'success')
        setAddingUnavailable(false)
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
      const result = await addCalendarEvent({ title: eventTitle, start_date: date, end_date: eventEndDate || date, notes: eventNotes.trim() || null })
      if (result.error) toast(result.error, 'error')
      else {
        toast('Added', 'success')
        setAddingEvent(false)
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

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} className="max-w-md">
      <div className="space-y-5">
        {!hasAnything && !addingUnavailable && !addingEvent && (
          <p className="text-sm text-gray-400">Nothing on this day yet</p>
        )}

        {items.shows.length > 0 && (
          <div className="space-y-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Shows</h3>
            {items.shows.map(s => (
              <Link key={s.id} href={`/shows/${s.id}`} className="flex items-center gap-2 rounded-md bg-brand-50 px-3 py-2 text-sm text-gray-800 hover:bg-brand-100">
                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-brand-500" />
                <span className="min-w-0 flex-1 truncate">{s.title}</span>
                {s.venue && <span className="shrink-0 text-xs text-gray-400">{s.venue}</span>}
              </Link>
            ))}
          </div>
        )}

        {items.tasks.length > 0 && (
          <div className="space-y-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Tasks</h3>
            {items.tasks.map(t => (
              <Link key={t.id} href="/notes" className={cn('flex items-center gap-2 rounded-md bg-violet-50 px-3 py-2 text-sm text-gray-800 hover:bg-violet-100', t.completed_at && 'opacity-60')}>
                <StickyNote className="h-3.5 w-3.5 shrink-0 text-violet-500" />
                <span className={cn('min-w-0 flex-1 truncate', t.completed_at && 'line-through')}>{t.title}</span>
                {t.assigned_to && <span className="shrink-0 text-xs text-gray-400">{nameById[t.assigned_to] ?? 'Someone'}</span>}
              </Link>
            ))}
          </div>
        )}

        {items.unavailability.length > 0 && (
          <div className="space-y-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Unavailable</h3>
            {items.unavailability.map(u => (
              <div key={u.id} className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
                <UserX className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                <span className="min-w-0 flex-1 truncate">{nameById[u.member_id] ?? 'Someone'}{u.reason ? ` — ${u.reason}` : ''}</span>
                <button type="button" onClick={() => handleDeleteUnavailable(u.id)} disabled={isPending} className="shrink-0 text-gray-400 hover:text-red-500 disabled:opacity-50" aria-label="Remove">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {items.events.length > 0 && (
          <div className="space-y-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Events</h3>
            {items.events.map(e => (
              <div key={e.id} className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-gray-800">
                <Tag className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                <span className="min-w-0 flex-1 truncate">{e.title}{e.notes ? ` — ${e.notes}` : ''}</span>
                <button type="button" onClick={() => handleDeleteEvent(e.id)} disabled={isPending} className="shrink-0 text-gray-400 hover:text-red-500 disabled:opacity-50" aria-label="Remove">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {addingUnavailable ? (
          <form onSubmit={handleAddUnavailable} className="space-y-3 rounded-lg border border-brand-200 bg-brand-50 p-3">
            <div>
              <Label htmlFor="unavail-member">Who&apos;s unavailable</Label>
              <select
                id="unavail-member"
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                value={memberId}
                onChange={e => setMemberId(e.target.value)}
              >
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="unavail-end">Through</Label>
              <Input id="unavail-end" type="date" className="mt-1" value={endDate} min={date} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="unavail-reason">Reason</Label>
              <Input id="unavail-reason" placeholder="Optional" className="mt-1" value={reason} onChange={e => setReason(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setAddingUnavailable(false)}>Cancel</Button>
              <Button type="submit" size="sm" loading={isPending} disabled={!memberId}>Save</Button>
            </div>
          </form>
        ) : addingEvent ? (
          <form onSubmit={handleAddEvent} className="space-y-3 rounded-lg border border-brand-200 bg-brand-50 p-3">
            <div>
              <Label htmlFor="event-title">What&apos;s happening</Label>
              <Input id="event-title" placeholder="Rehearsal, deadline, anything" className="mt-1" value={eventTitle} onChange={e => setEventTitle(e.target.value)} autoFocus />
            </div>
            <div>
              <Label htmlFor="event-end">Through</Label>
              <Input id="event-end" type="date" className="mt-1" value={eventEndDate} min={date} onChange={e => setEventEndDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="event-notes">Notes</Label>
              <Input id="event-notes" placeholder="Optional" className="mt-1" value={eventNotes} onChange={e => setEventNotes(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setAddingEvent(false)}>Cancel</Button>
              <Button type="submit" size="sm" loading={isPending} disabled={!eventTitle.trim()}>Save</Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap gap-2 border-t border-brand-100 pt-4">
            <Button variant="secondary" size="sm" asChild>
              <Link href={`/shows/new?date=${date}`}><Plus className="h-3.5 w-3.5" /> Show</Link>
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setTaskModalOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Task
            </Button>
            <Button variant="secondary" size="sm" onClick={() => { setEndDate(date); setAddingUnavailable(true) }}>
              <Plus className="h-3.5 w-3.5" /> Unavailable
            </Button>
            <Button variant="secondary" size="sm" onClick={() => { setEventEndDate(date); setAddingEvent(true) }}>
              <Plus className="h-3.5 w-3.5" /> Event
            </Button>
          </div>
        )}
      </div>

      <NoteModal members={members} open={taskModalOpen} onOpenChange={setTaskModalOpen} defaultDueDate={date} />
    </Modal>
  )
}
