'use client'

import { useState, useTransition } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toaster'
import { VisibilitySelect } from '@/components/calendar/VisibilitySelect'
import { addCalendarEvent } from '@/actions/calendar-events'
import { addUnavailability } from '@/actions/unavailability'
import { DEFAULT_VISIBILITY, type Visibility } from '@/lib/visibility'
import { todayISO } from '@/lib/shows'

type Mode = 'event' | 'unavailable'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Who can be marked unavailable. Loads a moment after the form opens, so it may be empty at first. */
  members: { id: string; name: string; isYou?: boolean }[]
}

const selectCls = 'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400'

/** "Add to calendar" from anywhere: an event, or someone being unavailable (same two choices as the calendar's day panel). */
export function QuickEventModal({ open, onOpenChange, members }: Props) {
  const [mode, setMode] = useState<Mode>('event')
  const [title, setTitle] = useState('')
  const [memberId, setMemberId] = useState('')
  const [reason, setReason] = useState('')
  const [start, setStart] = useState(todayISO())
  const [end, setEnd] = useState(todayISO())
  const [notes, setNotes] = useState('')
  const [visibility, setVisibility] = useState<Visibility>(DEFAULT_VISIBILITY)
  const [pending, startTransition] = useTransition()
  const toast = useToast()

  // A fresh form each time it opens ("adjust state during render", no effect).
  const [prevOpen, setPrevOpen] = useState(false)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      const today = todayISO()
      setMode('event'); setTitle(''); setMemberId(''); setReason(''); setStart(today); setEnd(today); setNotes(''); setVisibility(DEFAULT_VISIBILITY)
    }
  }

  // Whoever is adding it, unless they pick someone else.
  const who = memberId || members.find(m => m.isYou)?.id || members[0]?.id || ''
  const canSave = mode === 'event' ? !!title.trim() : !!who

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSave) return
    const endDate = end < start ? start : end
    startTransition(async () => {
      const result = mode === 'event'
        ? await addCalendarEvent({ title, start_date: start, end_date: endDate, notes: notes.trim() || null, visibility })
        : await addUnavailability({ member_id: who, start_date: start, end_date: endDate, reason: reason.trim() || null, visibility })
      if (result.error) { toast(result.error, 'error'); return }
      toast(mode === 'event' ? 'Event added' : 'Marked unavailable', 'success')
      onOpenChange(false)
    })
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Add to calendar" className="max-w-md">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center gap-1.5">
          <Chip active={mode === 'event'} onClick={() => setMode('event')}>Event</Chip>
          <Chip active={mode === 'unavailable'} onClick={() => setMode('unavailable')}>Unavailable</Chip>
        </div>

        {mode === 'event' ? (
          <div>
            <Label htmlFor="qe-title">What is it? *</Label>
            <Input id="qe-title" className="mt-1" placeholder="Rehearsal, deadline, anything" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
          </div>
        ) : (
          <div>
            <Label htmlFor="qe-who">Who’s unavailable</Label>
            <Select id="qe-who" className={selectCls} value={who} onChange={e => setMemberId(e.target.value)}>
              {members.length === 0 && <option value="">Loading…</option>}
              {members.map(m => <option key={m.id} value={m.id}>{m.isYou ? 'Me' : m.name}</option>)}
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="qe-start">From</Label>
            <Input id="qe-start" type="date" className="mt-1" value={start} onChange={e => { setStart(e.target.value); if (end < e.target.value) setEnd(e.target.value) }} />
          </div>
          <div>
            <Label htmlFor="qe-end">{mode === 'event' ? 'To' : 'Until'}</Label>
            <Input id="qe-end" type="date" className="mt-1" min={start} value={end} onChange={e => setEnd(e.target.value)} />
          </div>
        </div>

        {mode === 'event' ? (
          <div>
            <Label htmlFor="qe-notes">Notes <span className="font-normal text-gray-500">(optional)</span></Label>
            <Input id="qe-notes" className="mt-1" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        ) : (
          <div>
            <Label htmlFor="qe-reason">Reason <span className="font-normal text-gray-500">(optional)</span></Label>
            <Input id="qe-reason" className="mt-1" value={reason} onChange={e => setReason(e.target.value)} />
          </div>
        )}

        <VisibilitySelect id="qe-visibility" value={visibility} onChange={setVisibility} />
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" loading={pending} disabled={!canSave}>{mode === 'event' ? 'Add event' : 'Mark unavailable'}</Button>
        </div>
      </form>
    </Modal>
  )
}
