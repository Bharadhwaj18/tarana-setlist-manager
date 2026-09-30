'use client'

import { useState } from 'react'
import { Search, ChevronDown, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildSplitReportPdf } from '@/lib/pdf/financeReports'
import type { SplitRun } from '@/types'

interface Props {
  runs: SplitRun[]
  /** Ids of pending_payments rows not yet marked paid. */
  unpaidPendingIds: string[]
}

function fmt(n: number) {
  return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })
}

export function SplitHistoryList({ runs, unpaidPendingIds }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Set<string>>(new Set())
  const unpaid = new Set(unpaidPendingIds)

  const q = query.trim().toLowerCase()
  const filtered = q
    ? runs.filter(r =>
        r.shows.some(s => s.title.toLowerCase().includes(q)) ||
        r.payments.some(p => p.fromName.toLowerCase().includes(q) || p.toName.toLowerCase().includes(q))
      )
    : runs

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
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-300" />
        <input
          type="text"
          placeholder="Search by show or member…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full rounded-lg border border-brand-200 bg-white py-2.5 pl-9 pr-3 text-sm placeholder-gray-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">
          {query ? `No splits matching "${query}"` : 'No splits yet.'}
        </p>
      ) : (
        <div className="space-y-4">
          {filtered.map(run => {
            const isOpen = open.has(run.id)
            const transfers = run.payments.filter(p => p.kind === 'transfer')
            const selfPaid = run.payments.filter(p => p.kind === 'self')
            const totalMoved = run.payments.reduce((s, p) => s + p.amount, 0)
            const pendingCount = transfers.filter(p => p.pendingId && unpaid.has(p.pendingId)).length

            return (
              <section key={run.id} className="rounded-xl border border-brand-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">Split on {fmtDate(run.created_at)}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{run.shows.map(s => s.title).join(', ')}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold tabular-nums text-gray-900">{fmt(run.total_net)}</p>
                    <p className="text-[10px] uppercase tracking-wide text-gray-400">Net split</p>
                    {run.report && (
                      <button
                        type="button"
                        onClick={() => downloadReport(run)}
                        className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-brand-400 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-500"
                      >
                        <Download className="h-3.5 w-3.5" /> Report
                      </button>
                    )}
                  </div>
                </div>

                <div className="mb-3 flex flex-wrap gap-1.5 text-[11px]">
                  <span className="rounded-full bg-brand-100 px-2 py-0.5 font-medium text-brand-700">
                    {run.shows.length} show{run.shows.length !== 1 ? 's' : ''}
                  </span>
                  {run.band_pct !== null && (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 font-medium text-brand-700">
                      Band Fund {run.band_pct}%{run.total_band_fund !== null ? ` · ${fmt(run.total_band_fund)}` : ''}
                    </span>
                  )}
                  {pendingCount > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">{pendingCount} pending</span>
                  )}
                  {run.reconstructed && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-500">Reconstructed</span>
                  )}
                </div>

                {run.payments.length > 0 ? (
                  <div className="space-y-1.5">
                    {[...transfers, ...selfPaid].map((p, i) => {
                      const pending = p.pendingId ? unpaid.has(p.pendingId) : false
                      return (
                        <div key={i} className="flex items-center justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate text-gray-700">
                            {p.kind === 'self'
                              ? <>{p.fromName} <span className="text-xs text-gray-400">covered own share</span></>
                              : <>{p.fromName} → {p.toName}</>}
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            {p.kind === 'transfer' && (
                              <span className={cn(
                                'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                                pending ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                              )}>
                                {pending ? 'Pending' : 'Paid'}
                              </span>
                            )}
                            <span className="font-semibold tabular-nums text-gray-800">{fmt(p.amount)}</span>
                          </span>
                        </div>
                      )
                    })}
                    <div className="flex items-center justify-between border-t border-brand-100 pt-1.5 text-xs text-gray-400">
                      <span>Total paid out</span>
                      <span className="font-medium tabular-nums">{fmt(totalMoved)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No payments were recorded for this split.</p>
                )}

                <div className="mt-3 flex items-center justify-between gap-3 border-t border-brand-100 pt-3">
                  <button
                    type="button"
                    onClick={() => toggle(run.id)}
                    aria-expanded={isOpen}
                    className="flex items-center gap-1 text-xs font-medium text-brand-600"
                  >
                    <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-180')} />
                    {isOpen ? 'Hide' : 'Show'} per-show details
                  </button>
                </div>

                {isOpen && (
                  <div className="mt-3 space-y-3">
                    {run.shows.map(s => {
                      const detail = run.report?.shows.find(d => d.showTitle === s.title)
                      return (
                        <div key={s.id} className="rounded-lg bg-brand-50 px-3 py-2.5">
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="min-w-0 truncate text-sm font-medium text-gray-800">{s.title}</p>
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
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
