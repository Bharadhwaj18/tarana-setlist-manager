'use client'

import { useState } from 'react'
import { Search, ChevronDown, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildSplitReportPdf } from '@/lib/pdf/financeReports'
import { Chip } from '@/components/ui/Chip'
import { DateTile } from '@/components/ui/DateTile'
import { StatusPill } from '@/components/ui/StatusPill'
import type { SplitRun } from '@/types'

interface Props {
  runs: SplitRun[]
  /** Ids of pending_payments rows not yet marked paid. */
  unpaidPendingIds: string[]
}

type Filter = 'all' | 'pending' | 'paid'

function fmt(n: number) {
  return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

/** YYYY-MM-DD in IST, for the date tile. */
function istDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

export function SplitHistoryList({ runs, unpaidPendingIds }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [open, setOpen] = useState<Set<string>>(new Set())
  const unpaid = new Set(unpaidPendingIds)

  const pendingFor = (run: SplitRun) =>
    run.payments.filter(p => p.kind === 'transfer' && p.pendingId && unpaid.has(p.pendingId)).length

  const counts = {
    all: runs.length,
    pending: runs.filter(r => pendingFor(r) > 0).length,
  }

  const q = query.trim().toLowerCase()
  const filtered = runs
    .filter(r => filter === 'all' || (filter === 'pending' ? pendingFor(r) > 0 : pendingFor(r) === 0))
    .filter(r =>
      !q ||
      r.shows.some(s => s.title.toLowerCase().includes(q)) ||
      r.payments.some(p => p.fromName.toLowerCase().includes(q) || p.toName.toLowerCase().includes(q))
    )

  const toggle = (id: string) =>
    setOpen(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })

  const downloadReport = (run: SplitRun) => {
    const r = run.report
    if (!r) return
    buildSplitReportPdf(r.showTitles, r.bandPct, r.shows, r.rows, r.totalNet, r.totalBandFund, r.allBalances)
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>All {counts.all}</Chip>
        <Chip active={filter === 'pending'} onClick={() => setFilter('pending')}>Pending {counts.pending}</Chip>
        <Chip active={filter === 'paid'} onClick={() => setFilter('paid')}>All paid {counts.all - counts.pending}</Chip>
        <div className="relative w-full sm:ml-auto sm:w-60">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-300" />
          <input
            type="text"
            placeholder="Search by show or member…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full rounded-lg border border-brand-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">
          {query ? `No splits matching "${query}"` : filter === 'all' ? 'No splits yet.' : 'No splits in this view.'}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map(run => {
            const isOpen = open.has(run.id)
            const transfers = run.payments.filter(p => p.kind === 'transfer')
            const selfPaid = run.payments.filter(p => p.kind === 'self')
            const totalMoved = run.payments.reduce((s, p) => s + p.amount, 0)
            const pendingCount = pendingFor(run)
            const subtitle = [
              `${fmt(run.total_net)} total`,
              run.band_pct !== null ? `${run.band_pct}% band fund${run.total_band_fund !== null ? ` (${fmt(run.total_band_fund)})` : ''}` : null,
              `${transfers.length} transfer${transfers.length !== 1 ? 's' : ''}`,
            ].filter(Boolean).join(' · ')

            return (
              <section key={run.id} className="overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => toggle(run.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left sm:px-5"
                >
                  <DateTile date={istDate(run.created_at)} tone={pendingCount > 0 ? 'strong' : 'soft'} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-extrabold text-gray-900">{run.shows.map(s => s.title).join(' + ')}</p>
                    <p className="mt-0.5 text-[13px] text-gray-500">{subtitle}</p>
                  </div>
                  {pendingCount > 0 ? (
                    <StatusPill tone="amber">{pendingCount} pending</StatusPill>
                  ) : transfers.length > 0 ? (
                    <StatusPill tone="green">All paid</StatusPill>
                  ) : null}
                  {run.reconstructed && <StatusPill tone="gray">Reconstructed</StatusPill>}
                  <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-500 transition-transform', isOpen && 'rotate-180')} />
                </button>

                {isOpen && (
                  <div className="space-y-4 border-t border-brand-100 px-4 py-4 sm:px-5 sm:pl-[5.25rem]">
                    {run.payments.length > 0 ? (
                      <div className="divide-y divide-brand-100">
                        {[...transfers, ...selfPaid].map((p, i) => {
                          const pending = p.pendingId ? unpaid.has(p.pendingId) : false
                          return (
                            <div key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0">
                              <span className="min-w-0 truncate text-gray-800">
                                {p.kind === 'self'
                                  ? <>{p.fromName} <span className="text-xs text-gray-400">covered own share</span></>
                                  : <><b>{p.fromName}</b> pays <b>{p.toName}</b></>}
                              </span>
                              <span className="flex shrink-0 items-center gap-2">
                                <span className="font-bold tabular-nums text-gray-900">{fmt(p.amount)}</span>
                                {p.kind === 'transfer' && (
                                  <StatusPill tone={pending ? 'amber' : 'green'}>{pending ? 'Pending' : 'Paid'}</StatusPill>
                                )}
                              </span>
                            </div>
                          )
                        })}
                        <div className="flex items-center justify-between pt-2.5 text-xs text-gray-400">
                          <span>Total paid out</span>
                          <span className="font-medium tabular-nums">{fmt(totalMoved)}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">No payments were recorded for this split.</p>
                    )}

                    <div className="space-y-2">
                      {run.shows.map(s => {
                        const detail = run.report?.shows.find(d => d.showTitle === s.title)
                        return (
                          <div key={s.id} className="rounded-xl bg-brand-50 px-3.5 py-2.5">
                            <div className="flex items-baseline justify-between gap-3">
                              <p className="min-w-0 truncate text-sm font-semibold text-gray-800">{s.title}</p>
                              <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-800">{fmt(s.net)}</span>
                            </div>
                            {s.date && (
                              <p className="text-xs text-gray-400">
                                {new Date(s.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                              </p>
                            )}
                            {detail && (
                              <div className="mt-2 space-y-0.5 text-xs text-gray-500">
                                {detail.cuts.map(c => (
                                  <div key={c.name} className="flex justify-between gap-3">
                                    <span>{c.name}</span>
                                    <span className="tabular-nums">
                                      {fmt(c.cut)}{c.reimbursement > 0 ? ` + ${fmt(c.reimbursement)} reimbursed` : ''}
                                    </span>
                                  </div>
                                ))}
                                <div className="flex justify-between gap-3 border-t border-brand-100 pt-0.5">
                                  <span>Band Fund ({detail.bandFundHolderName})</span>
                                  <span className="tabular-nums">{fmt(detail.bandFundAmount)}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {run.report && (
                      <button
                        type="button"
                        onClick={() => downloadReport(run)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-500"
                      >
                        <Download className="h-3.5 w-3.5" /> Download report
                      </button>
                    )}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
