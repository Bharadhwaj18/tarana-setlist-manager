import Link from 'next/link'
import { ChevronLeft, Landmark } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getCachedAllProfiles } from '@/lib/data'
import { cn } from '@/lib/utils'
import type { FinanceTransaction } from '@/types/finance'

function fmt(n: number) {
  return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export default async function SplitHistoryPage() {
  const supabase = await createClient()

  const [profiles, { data: shows }, { data: allTxns }] = await Promise.all([
    getCachedAllProfiles(),
    supabase.from('finance_shows').select('*').not('split_at', 'is', null).order('split_at', { ascending: false }),
    supabase.from('finance_transactions').select('*').in('category', ['split', 'fund']),
  ])

  const nameOf = (id: string | null) =>
    id === null ? 'Unattributed' : (profiles.find(p => p.id === id)?.display_name ?? 'Member')

  const txnsByShow: Record<string, FinanceTransaction[]> = {}
  for (const t of allTxns ?? []) {
    if (!t.show_id) continue
    if (!txnsByShow[t.show_id]) txnsByShow[t.show_id] = []
    txnsByShow[t.show_id].push(t)
  }

  return (
    <div className="max-w-2xl">
      <Link href="/finance" className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> Finance
      </Link>
      <h1 className="mb-1 text-2xl font-bold text-gray-900">Split History</h1>
      <p className="mb-6 text-sm text-gray-500">Every show that&apos;s been split, with exactly who got what.</p>

      {!shows?.length ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center text-sm text-gray-400">
          No shows have been split yet.
        </div>
      ) : (
        <div className="space-y-4">
          {shows.map(show => {
            const txns = (txnsByShow[show.id] ?? []).sort((a, b) => (b.amount) - (a.amount))
            const bandFundTxn = txns.find(t => t.category === 'fund')
            const memberTxns = txns.filter(t => t.category === 'split' && t.amount > 0)
            const corrections = txns.filter(t => t.category === 'split' && t.amount < 0)

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

                <div className="space-y-1.5">
                  {memberTxns.map(t => (
                    <div key={t.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{nameOf(t.member_id)}</span>
                      <span className="font-semibold tabular-nums text-green-600">+{fmt(t.amount)}</span>
                    </div>
                  ))}
                  {bandFundTxn && (
                    <div className="flex items-center justify-between border-t border-brand-100 pt-1.5 text-sm">
                      <span className="flex items-center gap-1.5 text-brand-600">
                        <Landmark className="h-3.5 w-3.5" /> Band Fund cut <span className="text-xs text-gray-400">(kept by {nameOf(bandFundTxn.member_id)})</span>
                      </span>
                      <span className="font-semibold tabular-nums text-brand-700">+{fmt(bandFundTxn.amount)}</span>
                    </div>
                  )}
                  {corrections.length > 0 && (
                    <div className="space-y-1 border-t border-brand-100 pt-1.5">
                      {corrections.map(t => (
                        <div key={t.id} className="flex items-center justify-between text-xs text-gray-400">
                          <span>{nameOf(t.member_id)} — balance applied</span>
                          <span className={cn('tabular-nums')}>−{fmt(-t.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
