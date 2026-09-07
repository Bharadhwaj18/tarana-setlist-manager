import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Pencil, CalendarDays, MapPin, ListMusic, Wallet, CheckCircle2, Circle, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getCachedShow, getCachedAllProfiles, getCachedUser } from '@/lib/data'
import { Button } from '@/components/ui/Button'
import { DeleteShowButton } from '@/components/shows/DeleteShowButton'
import { AddTransactionModal } from '@/components/finance/AddTransactionModal'
import { cn } from '@/lib/utils'

function fmt(n: number) {
  return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function ShowDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [show, { data: { user } }, profiles, { data: txns }, { data: setlist }] = await Promise.all([
    getCachedShow(id),
    getCachedUser(),
    getCachedAllProfiles(),
    supabase.from('finance_transactions').select('*').eq('show_id', id).order('created_at', { ascending: false }),
    supabase.from('setlists').select('id, title').eq('show_id', id).maybeSingle(),
  ])

  if (!show) notFound()

  const members = profiles.map(p => ({ id: p.id, name: p.id === user?.id ? 'You' : (p.display_name ?? 'Member') }))
  const nameOf = (id: string | null) =>
    id === null ? 'Unattributed' : id === user?.id ? 'You' : (profiles.find(p => p.id === id)?.display_name ?? 'Member')

  const net = (txns ?? []).reduce((s, t) => s + t.amount, 0)
  const isSplit = !!show.split_at
  const date = show.show_date
    ? new Date(show.show_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <div className="max-w-2xl">
      <Link href="/shows" className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> Shows
      </Link>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{show.title}</h1>
            <span className={cn(
              'flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
              isSplit ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
            )}>
              {isSplit ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
              {isSplit ? 'Split' : 'Unsplit'}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-500">
            {date && <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{date}</span>}
            {show.venue && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{show.venue}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" asChild>
            <Link href={`/shows/${id}/edit`}><Pencil className="h-4 w-4" /> Edit</Link>
          </Button>
          <DeleteShowButton id={id} />
        </div>
      </div>

      {/* Setlist */}
      <section className="mb-5 rounded-xl border border-brand-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
          <ListMusic className="h-4 w-4 text-brand-600" /> Setlist
        </h2>
        {setlist ? (
          <Link href={`/setlists/${setlist.id}`} className="flex items-center justify-between rounded-lg bg-brand-50 px-4 py-3 text-sm font-medium text-gray-800 hover:bg-brand-100">
            {setlist.title}
            <span className="text-xs font-normal text-gray-400">View →</span>
          </Link>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">No setlist yet for this show.</p>
            <Button size="sm" asChild>
              <Link href={`/setlists/new?showId=${id}`}><Plus className="h-4 w-4" /> Create setlist</Link>
            </Button>
          </div>
        )}
      </section>

      {/* Finance */}
      <section className="mb-5 rounded-xl border border-brand-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Wallet className="h-4 w-4 text-brand-600" /> Finance
          </h2>
          <span className="text-sm font-bold text-gray-800">{fmt(net)}</span>
        </div>

        {(txns ?? []).length > 0 ? (
          <div className="mb-3 space-y-1">
            {(txns ?? []).map(t => (
              <div key={t.id} className="flex items-center justify-between text-xs text-gray-500">
                <span>{t.description} {t.member_id && <span className="text-gray-400">({nameOf(t.member_id)})</span>}</span>
                <span className={t.amount >= 0 ? 'text-green-600' : 'text-red-500'}>
                  {t.amount >= 0 ? '+' : '−'}{fmt(t.amount)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mb-3 text-sm text-gray-400">No transactions logged for this show yet.</p>
        )}

        <div className="flex items-center justify-between">
          <AddTransactionModal members={members} shows={[show]} lockedShow={{ id: show.id, title: show.title }} />
          {!isSplit && (
            <Button variant="secondary" size="sm" asChild>
              <Link href="/finance/split">Go split →</Link>
            </Button>
          )}
        </div>
      </section>

      {/* Fee & payment / TDS */}
      <section className="mb-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-brand-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Fee &amp; Payment</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-gray-500">Agreed fee</dt><dd className="font-medium text-gray-800">{show.fee != null ? fmt(show.fee) : '—'}</dd></div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Received</dt>
              <dd className={cn('font-medium', show.fee_received ? 'text-green-600' : 'text-amber-600')}>{show.fee_received ? 'Yes' : 'Not yet'}</dd>
            </div>
            {show.payment_reference && (
              <div className="flex justify-between"><dt className="text-gray-500">Reference</dt><dd className="font-medium text-gray-800">{show.payment_reference}</dd></div>
            )}
          </dl>
        </div>
        <div className="rounded-xl border border-brand-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">TDS</h2>
          {show.tds_applicable ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Amount</dt><dd className="font-medium text-gray-800">{show.tds_amount != null ? fmt(show.tds_amount) : '—'}</dd></div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Filed</dt>
                <dd className={cn('font-medium', show.tds_filed ? 'text-green-600' : 'text-amber-600')}>{show.tds_filed ? 'Yes' : 'Not yet'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Certificate</dt>
                <dd className={cn('font-medium', show.tds_certificate_received ? 'text-green-600' : 'text-amber-600')}>{show.tds_certificate_received ? 'Received' : 'Not yet'}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-gray-400">Not applicable for this show.</p>
          )}
        </div>
      </section>

      {/* Notes */}
      {show.notes && (
        <section className="rounded-xl border border-brand-200 bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Notes</h2>
          <p className="whitespace-pre-wrap text-sm text-gray-700">{show.notes}</p>
        </section>
      )}
    </div>
  )
}
