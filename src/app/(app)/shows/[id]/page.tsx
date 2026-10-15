import { notFound } from 'next/navigation'
import { sectionGuard } from '@/lib/section-guard'
import { LinkedNotes } from '@/components/notes/LinkedNotes'
import Link from 'next/link'
import { ChevronLeft, Pencil, MapPin, ListMusic, Wallet, Plus, Building2, User, Phone, Mail, Film, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getCachedShow, getCachedAllProfiles, getCachedUser, getCachedEventManagementCompany, getCachedFinanceSettings } from '@/lib/data'
import { formatMoney } from '@/lib/finance/settings'
import { Button } from '@/components/ui/Button'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { StatusPill, type PillTone } from '@/components/ui/StatusPill'
import { DateTile } from '@/components/ui/DateTile'
import { DeleteShowButton } from '@/components/shows/DeleteShowButton'
import { ShowDocuments } from '@/components/shows/ShowDocuments'
import { AddTransactionModal } from '@/components/finance/AddTransactionModal'
import { computeTds } from '@/lib/finance/tds'
import { todayISO } from '@/lib/shows'
import { countdownLabel } from '@/lib/dates'
import { cn } from '@/lib/utils'


const BOOKED = ['Confirmed', 'Advance Received', 'Completed']
const card = 'rounded-2xl border border-brand-200 bg-white p-5 shadow-sm'

interface Props {
  params: Promise<{ id: string }>
}

interface Step { label: string; tone: PillTone; done?: boolean }

function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <dt className="flex items-center gap-1.5 text-gray-500">{label}</dt>
      <dd className="text-right font-semibold text-gray-900">{children}</dd>
    </div>
  )
}

export default async function ShowDetailPage({ params }: Props) {
  const denied = await sectionGuard('shows')
  if (denied) return denied
  const moneySettings = await getCachedFinanceSettings()
  const fmt = (n: number) => formatMoney(n, moneySettings.currency)
  const { id } = await params
  const supabase = await createClient()

  const [show, { data: { user } }, profiles, { data: txns }, { data: setlist }, { data: documents }] = await Promise.all([
    getCachedShow(id),
    getCachedUser(),
    getCachedAllProfiles(),
    supabase.from('finance_transactions').select('*').eq('show_id', id).order('created_at', { ascending: false }),
    supabase.from('setlists').select('id, title').eq('show_id', id).maybeSingle(),
    supabase.from('show_documents').select('*').eq('show_id', id).order('created_at', { ascending: false }),
  ])

  if (!show) notFound()

  const eventManagementCompany = show.event_management_id
    ? await getCachedEventManagementCompany(show.event_management_id)
    : null

  const members = profiles.map(p => ({ id: p.id, name: p.id === user?.id ? 'You' : (p.display_name ?? 'Member') }))
  const nameOf = (id: string | null) =>
    id === null ? 'Unattributed' : id === user?.id ? 'You' : (profiles.find(p => p.id === id)?.display_name ?? 'Member')

  const net = (txns ?? []).reduce((s, t) => s + t.amount, 0)
  const isSplit = !!show.split_at
  const showHasQuote = show.booking_status ? show.booking_status !== 'Inquiry' : show.fee != null

  // TDS to claim is derived from what was actually credited for this show
  // (the real finance transactions), not the separately-typed "Amount
  // received" on the show's own edit form — a treasurer who logs income as
  // a transaction (the normal flow everywhere else in this app) never has
  // to duplicate that figure just to see the TDS math.
  const creditsTotal = (txns ?? []).filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const { tdsAmount: tdsToClaim, grossFee: tdsGrossFee } = computeTds(creditsTotal, show.tds_percentage ?? 0)

  const today = todayISO()
  const venueLine = [show.venue, show.show_date ? countdownLabel(show.show_date, today) : null].filter(Boolean).join(' · ')

  // Where this gig is in its life, from the real fields.
  const booked = !show.booking_status || BOOKED.includes(show.booking_status)
  const tdsDone = show.tds_filed && show.tds_certificate_received
  const steps: Step[] = [
    booked ? { label: 'Booked', tone: 'green', done: true } : { label: show.booking_status!, tone: 'amber' },
    setlist ? { label: 'Setlist ready', tone: 'green', done: true } : { label: 'Setlist needed', tone: 'amber' },
    show.fee_received ? { label: 'Paid', tone: 'green', done: true } : { label: 'Payment', tone: 'gray' },
    ...(show.tds_applicable
      ? [tdsDone ? { label: 'TDS', tone: 'green' as PillTone, done: true } : { label: 'TDS', tone: (show.tds_filed ? 'amber' : 'gray') as PillTone }]
      : []),
    isSplit ? { label: 'Split', tone: 'green', done: true } : { label: 'Split', tone: 'gray' },
  ]

  return (
    <div>
      <Link href="/shows" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> Shows
      </Link>

      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {show.show_date && <DateTile date={show.show_date} tone="strong" size="lg" />}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{show.title}</h1>
            {venueLine && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
                {show.venue && <MapPin className="h-4 w-4 shrink-0" />}{venueLine}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {show.booking_status && <StatusPill tone={BOOKED.includes(show.booking_status) ? 'green' : 'amber'}>{show.booking_status}</StatusPill>}
              {show.format && <StatusPill tone="gray">{show.format}</StatusPill>}
              <StatusPill tone={isSplit ? 'green' : 'amber'}>{isSplit ? 'Split' : 'Unsplit'}</StatusPill>
              {show.media_url && (
                <a href={show.media_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline">
                  <Film className="h-3.5 w-3.5" />Media
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" asChild>
            <Link href={`/shows/${id}/edit`}><Pencil className="h-4 w-4" /> Edit</Link>
          </Button>
          <DeleteShowButton id={id} />
        </div>
      </div>

      {/* Show progress */}
      <div className={cn(card, 'mb-5 flex items-center gap-2 overflow-x-auto py-3')}>
        <SectionLabel className="mr-2 shrink-0">Show progress</SectionLabel>
        {steps.map((step, i) => (
          <div key={`${step.label}-${i}`} className="flex shrink-0 items-center gap-2">
            {i > 0 && <span className="text-brand-300">—</span>}
            <StatusPill tone={step.tone} className="px-3 py-1 text-xs">
              {step.done && <Check className="mr-1 h-3 w-3" />}{step.label}
            </StatusPill>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr] lg:items-start">
        <div className="space-y-4">
          {/* Setlist */}
          <section className={cn(card, !setlist && 'border-dashed')}>
            <SectionLabel className="mb-3 flex items-center gap-2"><ListMusic className="h-4 w-4" /> Setlist</SectionLabel>
            {setlist ? (
              <Link href={`/setlists/${setlist.id}`} className="flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-brand-100">
                {setlist.title}
                <span className="text-xs font-normal text-gray-500">View →</span>
              </Link>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-gray-700">No setlist linked yet</p>
                <Button size="sm" asChild>
                  <Link href={`/setlists/new?showId=${id}`}><Plus className="h-4 w-4" /> Create setlist</Link>
                </Button>
              </div>
            )}
          </section>

          {/* Quotation / invoice files — once a quote is out (or any file already exists) */}
          {user && (showHasQuote || (documents ?? []).length > 0) && (
            <ShowDocuments showId={show.id} userId={user.id} documents={documents ?? []} />
          )}

          <LinkedNotes showId={show.id} />

          {/* Finance */}
          <section className={card}>
            <div className="mb-3 flex items-center justify-between">
              <SectionLabel className="flex items-center gap-2"><Wallet className="h-4 w-4" /> Finance</SectionLabel>
              <span className="font-display text-lg font-bold text-gray-900">{fmt(net)}</span>
            </div>

            {(txns ?? []).length > 0 ? (
              <div className="mb-3 space-y-1.5">
                {(txns ?? []).map(t => (
                  <div key={t.id} className="flex items-center justify-between gap-3 text-xs text-gray-500">
                    <span>{t.description} {t.member_id && <span className="text-gray-400">({nameOf(t.member_id)})</span>}</span>
                    <span className={cn('shrink-0 font-semibold', t.amount >= 0 ? 'text-green-600' : 'text-red-500')}>
                      {t.amount >= 0 ? '+' : '−'}{fmt(t.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mb-3 text-sm text-gray-400">No transactions logged for this show yet.</p>
            )}

            <AddTransactionModal members={members} shows={[show]} lockedShow={{ id: show.id, title: show.title }} />
          </section>

          {/* Notes */}
          {show.notes && (
            <section className={card}>
              <SectionLabel className="mb-2">Notes</SectionLabel>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{show.notes}</p>
            </section>
          )}
        </div>

        <div className="space-y-4">
          {/* Booking */}
          {(show.booking_status || eventManagementCompany || show.poc_name || show.poc_phone || show.poc_email) && (
            <section className={card}>
              <SectionLabel className="mb-3">Booking</SectionLabel>
              <dl className="space-y-2.5">
                <Row label="Booked through">
                  {eventManagementCompany ? (
                    <Link href={`/event-management/${eventManagementCompany.id}`} className="inline-flex items-center gap-1.5 text-brand-600 hover:underline">
                      <Building2 className="h-3.5 w-3.5" />{eventManagementCompany.name}
                    </Link>
                  ) : 'Direct booking'}
                </Row>
                {show.poc_name && <Row label={<><User className="h-3.5 w-3.5" />Contact</>}>{show.poc_name}</Row>}
                {show.poc_phone && <Row label={<><Phone className="h-3.5 w-3.5" />Phone</>}>{show.poc_phone}</Row>}
                {show.poc_email && <Row label={<><Mail className="h-3.5 w-3.5" />Email</>}>{show.poc_email}</Row>}
              </dl>
              {(show.poc_phone || show.poc_email) && (
                <div className="mt-4 flex gap-2">
                  {show.poc_phone && (
                    <a href={`tel:${show.poc_phone}`} className="rounded-lg bg-brand-100 px-3 py-1.5 text-xs font-bold text-gray-800 hover:bg-brand-200">Call</a>
                  )}
                  {show.poc_email && (
                    <a href={`mailto:${show.poc_email}`} className="rounded-lg bg-brand-100 px-3 py-1.5 text-xs font-bold text-gray-800 hover:bg-brand-200">Email</a>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Fee & payment */}
          <section className={card}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <SectionLabel>Fee &amp; payment</SectionLabel>
              <StatusPill tone={show.fee_received ? 'green' : 'amber'}>{show.fee_received ? 'Received' : 'Not received'}</StatusPill>
            </div>
            <p className="font-display text-3xl font-bold text-gray-900">{show.fee != null ? fmt(show.fee) : '—'}</p>
            <p className="mt-0.5 text-xs text-gray-500">{show.tds_applicable ? 'Amount received' : 'Quoted fee'}</p>
            {show.payment_reference && (
              <dl className="mt-3"><Row label="Reference">{show.payment_reference}</Row></dl>
            )}
          </section>

          {/* TDS — hidden when the workspace turns it off, unless this show already uses it */}
          {(moneySettings.features.tds || show.tds_applicable) && <section className={card}>
            <SectionLabel className="mb-3">TDS{show.tds_applicable && show.tds_percentage != null ? ` · ${show.tds_percentage}%` : ''}</SectionLabel>
            {show.tds_applicable ? (
              <dl className="space-y-2.5">
                {creditsTotal > 0 && <Row label="Gross fee">{fmt(tdsGrossFee)}</Row>}
                <Row label="To claim">{creditsTotal > 0 ? fmt(tdsToClaim) : '—'}</Row>
                <Row label="Filed"><span className={show.tds_filed ? 'text-green-600' : 'text-amber-600'}>{show.tds_filed ? 'Yes' : 'Not yet'}</span></Row>
                <Row label="Certificate"><span className={show.tds_certificate_received ? 'text-green-600' : 'text-amber-600'}>{show.tds_certificate_received ? 'Received' : 'Not yet'}</span></Row>
              </dl>
            ) : (
              <p className="text-sm text-gray-400">Not applicable for this show.</p>
            )}
          </section>}

          {/* Split */}
          <section className="flex items-center justify-between gap-3 rounded-2xl bg-hero p-5 text-hero-fg shadow-sm">
            <div>
              <p className="font-bold">{isSplit ? 'This show is split' : 'Split this show'}</p>
              <p className="mt-0.5 text-xs text-hero-muted">
                {isSplit ? 'Everyone has been credited their share.' : net > 0 ? 'Payment is logged, ready to split.' : 'Log the payment first, then split.'}
              </p>
            </div>
            {!isSplit && (
              <Link href="/finance/split" className="shrink-0 rounded-lg bg-sidebar-accent px-4 py-2 text-sm font-bold text-sidebar-active-fg hover:opacity-90">
                Go split →
              </Link>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
