'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import type { FinanceTransaction } from '@/types/finance'
import type { Show } from '@/types/shows'

interface Props {
  shows: Show[]
  txnsByShow: Record<string, FinanceTransaction[]>
  profiles: { id: string; display_name: string | null }[]
}

function fmt(n: number) {
  return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export function SplitHistoryList({ shows, txnsByShow, profiles }: Props) {
  const [query, setQuery] = useState('')

  // A plain function prop isn't serializable across the server/client
  // boundary — pass the raw profiles instead and resolve names in here.
  const nameOf = (id: string | null) =>
    id === null ? 'Unattributed' : (profiles.find(p => p.id === id)?.display_name ?? 'Member')

  const q = query.trim().toLowerCase()
  const filtered = q
    ? shows.filter(show => {
        if (show.title.toLowerCase().includes(q)) return true
        if (show.venue?.toLowerCase().includes(q)) return true
        if (show.notes?.toLowerCase().includes(q)) return true
        return (txnsByShow[show.id] ?? []).some(t =>
          nameOf(t.member_id).toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
        )
      })
    : shows

  return (
    <div>
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-300" />
        <input
          type="text"
          placeholder="Search by show, venue, notes, or member…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full rounded-lg border border-brand-200 bg-white py-2.5 pl-9 pr-3 text-sm placeholder-gray-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">
          {query ? `No split shows matching "${query}"` : 'No shows have been split yet.'}
        </p>
      ) : (
        <div className="space-y-4">
          {filtered.map(show => {
            // Every split payment is a single debit on the payer —
            // category 'split', always a negative amount. A self-payment
            // (from === to, covering their own share from their own Band
            // Fund) reads the same way, no special casing.
            const payments = (txnsByShow[show.id] ?? [])
              .filter(t => t.category === 'split')
              .sort((a, b) => a.amount - b.amount)
            const totalPaidOut = payments.reduce((s, t) => s + t.amount, 0)

            return (
              <section key={show.id} className="rounded-xl border border-brand-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{show.title}</p>
                    <p className="text-xs text-gray-400">
                      {show.show_date && new Date(show.show_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                      {show.venue ? ` · ${show.venue}` : ''}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs text-gray-400">
                    Split {show.split_at && new Date(show.split_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </p>
                </div>

                {payments.length > 0 ? (
                  <div className="space-y-1.5">
                    {payments.map(t => (
                      <div key={t.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">
                          {nameOf(t.member_id)} <span className="text-xs text-gray-400">— {t.description}</span>
                        </span>
                        <span className="font-semibold tabular-nums text-red-500">−{fmt(t.amount)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-brand-100 pt-1.5 text-xs text-gray-400">
                      <span>Total paid out</span>
                      <span className="font-medium tabular-nums">−{fmt(totalPaidOut)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No settlement transactions recorded for this show.</p>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
