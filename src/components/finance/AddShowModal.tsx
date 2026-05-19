'use client'

import { useState, useTransition } from 'react'
import { PlusCircle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { addShow } from '@/actions/finance'
import { useToast } from '@/components/ui/Toaster'

const inputCls = 'w-full rounded-md border border-brand-200 bg-white px-3 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400'

export function AddShowModal() {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [venue, setVenue] = useState('')
  const [gross, setGross] = useState('')
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  const reset = () => { setTitle(''); setDate(''); setVenue(''); setGross('') }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const grossNum = parseFloat(gross)
    if (!grossNum || grossNum <= 0 || !title.trim()) return
    startTransition(async () => {
      const result = await addShow({
        title: title.trim(),
        show_date: date || null,
        venue: venue.trim() || null,
        gross_income: grossNum,
      })
      if (result.error) {
        toast(result.error, 'error')
      } else {
        toast('Show recorded', 'success')
        setOpen(false)
        reset()
      }
    })
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <PlusCircle className="h-4 w-4" /> Record Show
      </Button>

      <Modal open={open} onOpenChange={o => { setOpen(o); if (!o) reset() }} title="Record Show" description="Add a show to split later.">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Show name *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Mood Indigo" className={inputCls} autoFocus required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Venue</label>
              <input type="text" value={venue} onChange={e => setVenue(e.target.value)}
                placeholder="e.g. Blue Frog" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Gross income (₹) *</label>
            <input type="number" min="1" step="any" value={gross} onChange={e => setGross(e.target.value)}
              placeholder="0" className={inputCls} required />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={isPending} disabled={!title.trim() || !gross}>Save</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
