'use client'

import { useMoney } from '@/components/finance/FinanceSettingsContext'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { Chip } from '@/components/ui/Chip'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { cn } from '@/lib/utils'
import { VisibilitySelect } from '@/components/calendar/VisibilitySelect'
import { asVisibility, type Visibility } from '@/lib/visibility'
import { computeTds } from '@/lib/finance/tds'
import type { ShowFormData } from '@/lib/validators'
import type { Show, EventManagement } from '@/types'
import { BOOKING_STATUSES, SHOW_FORMATS } from '@/types/shows'
import { Select } from '@/components/ui/Select'

interface ShowFormProps {
  show?: Show
  eventManagementCompanies?: EventManagement[]
  onSubmit: (data: ShowFormData) => Promise<{ error?: string; id?: string } | void>
  /** Pre-fills the show date — e.g. opened from a specific day on the Calendar. Ignored when editing an existing show. */
  initialDate?: string
}

const DIRECT_BOOKING = 'direct'


function fieldsFrom(show: Show | undefined, initialDate: string | undefined) {
  return {
    title: show?.title ?? '',
    show_date: show?.show_date ?? initialDate ?? '',
    venue: show?.venue ?? '',
    fee: show?.fee != null ? String(show.fee) : '',
    fee_received: show?.fee_received ?? false,
    payment_reference: show?.payment_reference ?? '',
    tds_applicable: show?.tds_applicable ?? false,
    tds_percentage: show?.tds_percentage != null ? String(show.tds_percentage) : '',
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
    visibility: asVisibility(show?.visibility) as Visibility,
  }
}

function Toggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-lg px-4 py-2 text-sm font-bold transition-colors',
        active ? 'bg-brand-400 text-white' : 'bg-brand-100 text-gray-700 hover:bg-brand-200'
      )}
    >
      {label}
    </button>
  )
}

const card = 'scroll-mt-4 space-y-4 rounded-2xl border border-brand-200 bg-white p-5 shadow-sm'
const selectClass = 'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400'

export function ShowForm({ show, eventManagementCompanies = [], onSubmit, initialDate }: ShowFormProps) {
  const { money: fmt, symbol, settings: moneySettings } = useMoney()
  const [fields, setFields] = useState(() => fieldsFrom(show, initialDate))
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const set = <K extends keyof typeof fields>(key: K, value: typeof fields[K]) =>
    setFields(prev => ({ ...prev, [key]: value }))

  const canSubmit = fields.title.trim() !== ''

  // Money only matters once a quote is out. Older shows with no status but a fee still show it.
  const showFinance = fields.booking_status
    ? fields.booking_status !== 'Inquiry'
    : show?.fee != null

  const pickCompany = (id: string) => {
    const c = eventManagementCompanies.find(x => x.id === id)
    setFields(prev => ({
      ...prev,
      event_management_id: id,
      poc_name: c?.contact_name ?? prev.poc_name,
      poc_phone: c?.contact_phone ?? prev.poc_phone,
      poc_email: c?.contact_email ?? prev.poc_email,
    }))
  }

  const feeNum = parseFloat(fields.fee) || 0
  const tdsPercentageNum = parseFloat(fields.tds_percentage) || 0
  const showTds = moneySettings.features.tds || fields.tds_applicable
  const { tdsAmount, grossFee } = computeTds(feeNum, tdsPercentageNum)

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
        tds_percentage: fields.tds_applicable && fields.tds_percentage ? tdsPercentageNum : null,
        tds_amount: fields.tds_applicable && tdsAmount > 0 ? Math.round(tdsAmount * 100) / 100 : null,
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
        visibility: fields.visibility,
      }
      const result = await onSubmit(data)
      if (result && 'error' in result && result.error) setError(result.error)
    })
  }

  const sections = [
    { id: 'gig', label: 'The gig' },
    { id: 'booking', label: 'Booking & contact' },
    ...(showFinance ? [{ id: 'money', label: showTds ? 'Money & TDS' : 'Money' }] : []),
    { id: 'notes', label: 'Notes & media' },
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <nav aria-label="Form sections" className="flex gap-2 overflow-x-auto pb-1">
        {sections.map(sec => (
          <a key={sec.id} href={`#show-${sec.id}`} className="shrink-0 rounded-full bg-brand-100 px-3.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-brand-200">{sec.label}</a>
        ))}
      </nav>

      {/* The gig */}
      <section id="show-gig" className={card}>
        <SectionLabel>The gig</SectionLabel>
        <div>
          <Label htmlFor="title">Show Title *</Label>
          <Input id="title" className="mt-1" placeholder="Babai Tiffins HSR" value={fields.title}
            onChange={e => set('title', e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          <Label>Format</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {SHOW_FORMATS.map(f => (
              <Chip key={f} active={fields.format === f} onClick={() => set('format', fields.format === f ? '' : f)}>{f}</Chip>
            ))}
          </div>
        </div>
        <div>
          <Label>Status</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {BOOKING_STATUSES.map(st => (
              <Chip key={st} active={fields.booking_status === st} onClick={() => set('booking_status', fields.booking_status === st ? '' : st)}>{st}</Chip>
            ))}
          </div>
        </div>
      </section>

      {/* Booking */}
      <section id="show-booking" className={card}>
        <SectionLabel>Booking &amp; contact</SectionLabel>
        <div>
          <Label htmlFor="event_management_id">Booked through</Label>
          <Select
            id="event_management_id"
            className={selectClass}
            value={fields.event_management_id}
            onChange={e => pickCompany(e.target.value)}
          >
            <option value={DIRECT_BOOKING}>Direct booking</option>
            {eventManagementCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
      </section>

      {showFinance && (
        <div id="show-money" className="scroll-mt-4 space-y-4">
          {/* Fee & payment */}
          <section className={card}>
            <SectionLabel>Fee &amp; Payment</SectionLabel>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="fee">{fields.tds_applicable ? `Amount received (${symbol})` : `Quoted fee (${symbol})`}</Label>
                <Input id="fee" type="number" min="0" step="any" placeholder="0" className="mt-1" value={fields.fee}
                  onChange={e => set('fee', e.target.value)} />
                {fields.tds_applicable && (
                  <p className="mt-1 text-xs text-gray-500">What actually hit the account, after TDS was withheld.</p>
                )}
              </div>
              <div>
                <Label htmlFor="payment_reference">Payment / invoice ref</Label>
                <Input id="payment_reference" placeholder="Optional" className="mt-1" value={fields.payment_reference}
                  onChange={e => set('payment_reference', e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Payment received?</Label>
              <div className="mt-2 flex gap-2">
                <Toggle label="Not yet" active={!fields.fee_received} onClick={() => set('fee_received', false)} />
                <Toggle label="Received" active={fields.fee_received} onClick={() => set('fee_received', true)} />
              </div>
            </div>
          </section>

          {/* TDS — hidden when the workspace turns it off, unless this show already uses it */}
          {showTds && <section className={card}>
            <SectionLabel>TDS</SectionLabel>
            <div>
              <Label>Is TDS applicable for this show?</Label>
              <div className="mt-2 flex gap-2">
                <Toggle label="No" active={!fields.tds_applicable} onClick={() => set('tds_applicable', false)} />
                <Toggle label="Yes" active={fields.tds_applicable} onClick={() => set('tds_applicable', true)} />
              </div>
            </div>
            {fields.tds_applicable && (
              <>
                <div>
                  <Label htmlFor="tds_percentage">TDS rate (%)</Label>
                  <Input id="tds_percentage" type="number" min="0" max="100" step="any" placeholder="10" className="mt-1" value={fields.tds_percentage}
                    onChange={e => set('tds_percentage', e.target.value)} />
                </div>
                {tdsAmount > 0 && (
                  <div className="rounded-xl bg-brand-50 px-3 py-2.5 text-xs text-gray-600">
                    {fmt(feeNum)} received is the other {(100 - tdsPercentageNum).toFixed(tdsPercentageNum % 1 ? 1 : 0)}% —
                    that puts the gross fee at <span className="font-semibold text-gray-900">{fmt(grossFee)}</span>, with{' '}
                    <span className="font-semibold text-gray-900">{fmt(tdsAmount)}</span> in TDS still to claim via the certificate.
                  </div>
                )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Filed / deposited?</Label>
                    <div className="mt-2 flex gap-2">
                      <Toggle label="Not yet" active={!fields.tds_filed} onClick={() => set('tds_filed', false)} />
                      <Toggle label="Filed" active={fields.tds_filed} onClick={() => set('tds_filed', true)} />
                    </div>
                  </div>
                  <div>
                    <Label>Certificate received?</Label>
                    <div className="mt-2 flex gap-2">
                      <Toggle label="Not yet" active={!fields.tds_certificate_received} onClick={() => set('tds_certificate_received', false)} />
                      <Toggle label="Received" active={fields.tds_certificate_received} onClick={() => set('tds_certificate_received', true)} />
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>}
        </div>
      )}

      {/* Notes & media */}
      <section id="show-notes" className={card}>
        <SectionLabel>Notes &amp; media</SectionLabel>
        <div>
          <Label htmlFor="media_url">Media link</Label>
          <Input id="media_url" type="url" placeholder="https://mega.nz/folder/..." className="mt-1" value={fields.media_url}
            onChange={e => set('media_url', e.target.value)} />
        </div>
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" rows={3} placeholder="Anything else about this show..." className="mt-1" value={fields.notes}
            onChange={e => set('notes', e.target.value)} />
        </div>
        <VisibilitySelect id="visibility" value={fields.visibility} onChange={v => set('visibility', v)} />
      </section>

      {/* Sticky save bar — sits above the phone tab bar */}
      <div className="sticky bottom-[4.5rem] z-10 -mx-4 flex items-center justify-between gap-3 border-t border-brand-200 bg-brand-50/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:bottom-0 lg:px-8">
        <p className="min-w-0 truncate text-sm text-gray-500">
          {error ? <span className="text-red-600">{error}</span> : showFinance ? 'Changes are saved when you press the button.' : 'Money and TDS appear once a quote is out.'}
        </p>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="secondary" onClick={() => history.back()}>Cancel</Button>
          <Button type="submit" loading={isPending} disabled={!canSubmit}>{show ? 'Save changes' : 'Create show'}</Button>
        </div>
      </div>
    </form>
  )
}
