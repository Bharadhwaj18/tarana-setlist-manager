'use client'

import { useState, useTransition } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { useToast } from '@/components/ui/Toaster'
import { VisibilitySelect } from '@/components/calendar/VisibilitySelect'
import { addCalendarEvent } from '@/actions/calendar-events'
import { DEFAULT_VISIBILITY, type Visibility } from '@/lib/visibility'
import { todayISO } from '@/lib/shows'

/** "Add calendar event" from anywhere: a title and a date, with the rest tucked away. */
export function QuickEventModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [title, setTitle] = useState('')
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
      setTitle(''); setStart(today); setEnd(today); setNotes(''); setVisibility(DEFAULT_VISIBILITY)
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    startTransition(async () => {
      const result = await addCalendarEvent({ title, start_date: start, end_date: end < start ? start : end, notes: notes.trim() || null, visibility })
      if (result.error) { toast(result.error, 'error'); return }
      toast('Event added', 'success')
      onOpenChange(false)
    })
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="New calendar event" className="max-w-md">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="qe-title">What is it? *</Label>
          <Input id="qe-title" className="mt-1" placeholder="Rehearsal, deadline, anything" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="qe-start">From</Label>
            <Input id="qe-start" type="date" className="mt-1" value={start} onChange={e => { setStart(e.target.value); if (end < e.target.value) setEnd(e.target.value) }} />
          </div>
          <div>
            <Label htmlFor="qe-end">To</Label>
            <Input id="qe-end" type="date" className="mt-1" min={start} value={end} onChange={e => setEnd(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="qe-notes">Notes <span className="font-normal text-gray-500">(optional)</span></Label>
          <Input id="qe-notes" className="mt-1" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <VisibilitySelect id="qe-visibility" value={visibility} onChange={setVisibility} />
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" loading={pending} disabled={!title.trim()}>Add event</Button>
        </div>
      </form>
    </Modal>
  )
}
