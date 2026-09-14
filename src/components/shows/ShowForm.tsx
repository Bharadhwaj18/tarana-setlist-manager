'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/lib/utils'
import type { ShowFormData } from '@/lib/validators'
import type { Show, EventManagement } from '@/types'
import { BOOKING_STATUSES, SHOW_FORMATS } from '@/types/shows'

interface ShowFormProps {
  show?: Show
  eventManagementCompanies?: EventManagement[]
  onSubmit: (data: ShowFormData) => Promise<{ error?: string; id?: string } | void>
}

const DIRECT_BOOKING = 'direct'

function fieldsFrom(show: Show | undefined) {
  return {
    title: show?.title ?? '',
    show_date: show?.show_date ?? '',
    venue: show?.venue ?? '',
    fee: show?.fee != null ? String(show.fee) : '',
    fee_received: show?.fee_received ?? false,
    payment_reference: show?.payment_reference ?? '',
    tds_applicable: show?.tds_applicable ?? false,
    tds_amount: show?.tds_amount != null ? String(show.tds_amount) : '',
    tds_filed: show?.tds_filed ?? false,
    tds_certificate_received: show?.tds_certificate_received ?? false,
    booking_status: show?.booking_status ?? '',
    event_management_id: show?.event_management_id ?? DIRECT_BOOKING,
    poc_name: show?.poc_name ?? '',
    poc_phone: show?.poc_phone ?? '',
    poc_email: show?.poc_email ?? '',
    format: show?.format ?? '',
    media_url: show?.media_url ?? '',
    notes: show?.notes ?? '',
  }
}

function Toggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md px-3 py-2 text-sm font-semibold transition-colors',
        active ? 'bg-brand-400 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      )}
    >
      {label}
    </button>
  )
}

export function ShowForm({ show, eventManagementCompanies = [], onSubmit }: ShowFormProps) {
  const [fields, setFields] = useState(() => fieldsFrom(show))
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const set = <K extends keyof typeof fields>(key: K, value: typeof fields[K]) =>
    setFields(prev => ({ ...prev, [key]: value }))

  const canSubmit = fields.title.trim() !== ''

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)

    startTransition(async () => {
      const data: ShowFormData = {
        title: fields.title.trim(),
        show_date: fields.show_date || null,
        venue: fields.venue.trim() || null,
        fee: fields.fee ? parseFloat(fields.fee) : null,
        fee_received: fields.fee_received,
        payment_reference: fields.payment_reference.trim() || null,
        tds_applicable: fields.tds_applicable,
        tds_amount: fields.tds_amount ? parseFloat(fields.tds_amount) : null,
        tds_filed: fields.tds_filed,
        tds_certificate_received: fields.tds_certificate_received,
        booking_status: fields.booking_status || null,
        event_management_id: fields.event_management_id === DIRECT_BOOKING ? null : fields.event_management_id,
        poc_name: fields.poc_name.trim() || null,
        poc_phone: fields.poc_phone.trim() || null,
        poc_email: fields.poc_email.trim() || null,
        format: fields.format || null,
        media_url: fields.media_url.trim() || null,
        notes: fields.notes.trim() || null,
      }
      const result = await onSubmit(data)
      if (result && 'error' in result && result.error) setError(result.error)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basics */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="title">Show Title *</Label>
          <Input id="title" className="mt-1" placeholder="Babai Tiffins HSR" value={fields.title}
            onChange={e => set('title', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="show_date">Show Date</Label>
            <Input id="show_date" type="date" className="mt-1" value={fields.show_date}
              onChange={e => set('show_date', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="venue">Venue</Label>
            <Input id="venue" placeholder="Blue Frog" className="mt-1" value={fields.venue}
              onChange={e => set('venue', e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="format">Format</Label>
          <select
            id="format"
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
            value={fields.format}
            onChange={e => set('format', e.target.value)}
          >
            <option value="">—</option>
            {SHOW_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>

      {/* Booking */}
      <div className="space-y-4 rounded-lg border border-brand-200 bg-brand-50 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Booking</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="booking_status">Status</Label>
            <select
              id="booking_status"
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
              value={fields.booking_status}
              onChange={e => set('booking_status', e.target.value)}
            >
              <option value="">—</option>
              {BOOKING_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="event_management_id">Booked through</Label>
            <select
              id="event_management_id"
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
              value={fields.event_management_id}
              onChange={e => set('event_management_id', e.target.value)}
            >
              <option value={DIRECT_BOOKING}>Direct booking</option>
              {eventManagementCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="poc_name">POC name</Label>
            <Input id="poc_name" placeholder="Optional" className="mt-1" value={fields.poc_name}
              onChange={e => set('poc_name', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="poc_phone">POC phone</Label>
            <Input id="poc_phone" type="tel" placeholder="Optional" className="mt-1" value={fields.poc_phone}
              onChange={e => set('poc_phone', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="poc_email">POC email</Label>
            <Input id="poc_email" type="email" placeholder="Optional" className="mt-1" value={fields.poc_email}
              onChange={e => set('poc_email', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Fee & payment */}
      <div className="space-y-3 rounded-lg border border-brand-200 bg-brand-50 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Fee &amp; Payment</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="fee">Agreed fee (₹)</Label>
            <Input id="fee" type="number" min="0" step="any" placeholder="0" className="mt-1" value={fields.fee}
              onChange={e => set('fee', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="payment_reference">Payment / invoice ref</Label>
            <Input id="payment_reference" placeholder="Optional" className="mt-1" value={fields.payment_reference}
              onChange={e => set('payment_reference', e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Payment received?</Label>
          <div className="mt-1 flex gap-2">
            <Toggle label="Not yet" active={!fields.fee_received} onClick={() => set('fee_received', false)} />
            <Toggle label="Received" active={fields.fee_received} onClick={() => set('fee_received', true)} />
          </div>
        </div>
      </div>

      {/* TDS */}
      <div className="space-y-3 rounded-lg border border-brand-200 bg-brand-50 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">TDS</h3>
        <div>
          <Label>Is TDS applicable for this show?</Label>
          <div className="mt-1 flex gap-2">
            <Toggle label="No" active={!fields.tds_applicable} onClick={() => set('tds_applicable', false)} />
            <Toggle label="Yes" active={fields.tds_applicable} onClick={() => set('tds_applicable', true)} />
          </div>
        </div>
        {fields.tds_applicable && (
          <>
            <div>
              <Label htmlFor="tds_amount">TDS amount (₹)</Label>
              <Input id="tds_amount" type="number" min="0" step="any" placeholder="0" className="mt-1" value={fields.tds_amount}
                onChange={e => set('tds_amount', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Filed / deposited?</Label>
                <div className="mt-1 flex gap-2">
                  <Toggle label="Not yet" active={!fields.tds_filed} onClick={() => set('tds_filed', false)} />
                  <Toggle label="Filed" active={fields.tds_filed} onClick={() => set('tds_filed', true)} />
                </div>
              </div>
              <div>
                <Label>Certificate received?</Label>
                <div className="mt-1 flex gap-2">
                  <Toggle label="Not yet" active={!fields.tds_certificate_received} onClick={() => set('tds_certificate_received', false)} />
                  <Toggle label="Received" active={fields.tds_certificate_received} onClick={() => set('tds_certificate_received', true)} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Media */}
      <div>
        <Label htmlFor="media_url">Media link</Label>
        <Input id="media_url" type="url" placeholder="https://mega.nz/folder/..." className="mt-1" value={fields.media_url}
          onChange={e => set('media_url', e.target.value)} />
      </div>

      {/* Notes */}
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={3} placeholder="Anything else about this show..." className="mt-1" value={fields.notes}
          onChange={e => set('notes', e.target.value)} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="secondary" onClick={() => history.back()}>Cancel</Button>
        <Button type="submit" loading={isPending} disabled={!canSubmit}>{show ? 'Save changes' : 'Create show'}</Button>
      </div>
    </form>
  )
}
