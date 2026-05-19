import Link from 'next/link'
import { TrendingUp, TrendingDown, ArrowRightLeft, Landmark } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getCachedAllProfiles } from '@/lib/data'
import { Button } from '@/components/ui/Button'
import { AddTransactionModal } from '@/components/finance/AddTransactionModal'
import { AddShowModal } from '@/components/finance/AddShowModal'
import { DeleteTransactionButton } from '@/components/finance/DeleteTransactionButton'
import { cn } from '@/lib/utils'

function fmt(n: number) {
  return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function sign(n: number) {
  return n >= 0 ? '+' : '−'
}

export default async function FinancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [profiles, { data: txns }, { data: shows }] = await Promise.all([
    getCachedAllProfiles(),
    supabase.from('finance_transactions').select('*').order('created_at', { ascending: false }),
    supabase.from('finance_shows').select('*').order('show_date', { ascending: false }),
  ])

  // Compute balances
  const balanceMap: Record<string, number> = { '__fund__': 0 }
  for (const t of txns ?? []) {
    const key = t.member_id ?? '__fund__'
    balanceMap[key] = (balanceMap[key] ?? 0) + t.amount
  }

  const members = profiles.map(p => ({
    id: p.id,
    name: p.id === user?.id ? 'You' : (p.display_name ?? 'Member'),
    balance: balanceMap[p.id] ?? 0,
  })).sort((a, b) => b.balance - a.balance)

  const bandFund = balanceMap['__fund__'] ?? 0
  const memberTotal = members.reduce((s, m) => s + m.balance, 0)
  const maxBal = Math.max(...members.map(m => Math.abs(m.balance)), Math.abs(bandFund), 1)

  const unsplitShows = (shows ?? []).filter(s => !s.split_at)
  const pendingTotal = unsplitShows.reduce((s, show) => s + show.gross_income, 0)
  const recentTxns = (txns ?? []).slice(0, 15)
  const nameOf = (id: string | null) =>
    id === null ? 'Band Fund' : id === user?.id ? 'You' : (profiles.find(p => p.id === id)?.display_name ?? 'Member')

  const memberOptions = [
    ...profiles.map(p => ({ id: p.id, name: p.id === user?.id ? 'You' : (p.display_name ?? 'Member') })),
    { id: null as unknown as string, name: 'Band Fund' },
  ]

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finance</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Total band fund: <span className="font-semibold text-gray-800">{fmt(memberTotal + pendingTotal)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AddShowModal />
          <AddTransactionModal members={memberOptions} />
          {unsplitShows.length > 0 && (
            <Button asChild>
              <Link href="/finance/split">
                <ArrowRightLeft className="h-4 w-4" /> Split Show Money
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Balances */}
      <section className="rounded-xl border border-brand-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Member Balances</h2>
        <div className="space-y-3">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-3">
              <span className="w-20 shrink-0 truncate text-sm font-medium text-gray-700">{m.name}</span>
              <div className="flex-1">
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={cn('h-full rounded-full', m.balance >= 0 ? 'bg-brand-400' : 'bg-red-400')}
                    style={{ width: `${Math.round((Math.abs(m.balance) / maxBal) * 100)}%` }}
                  />
                </div>
              </div>
              <span className={cn('w-24 text-right text-sm font-bold tabular-nums', m.balance < 0 ? 'text-red-600' : 'text-gray-800')}>
                {m.balance < 0 ? '−' : ''}{fmt(m.balance)}
              </span>
            </div>
          ))}

          {/* Band fund row */}
          <div className="mt-1 flex items-center gap-3 border-t border-brand-100 pt-3">
              <span className="flex w-20 shrink-0 items-center gap-1.5 text-sm font-medium text-brand-600">
                <Landmark className="h-3.5 w-3.5" /> Fund
              </span>
              <div className="flex-1">
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-brand-300"
                    style={{ width: `${Math.round((Math.abs(bandFund) / maxBal) * 100)}%` }}
                  />
                </div>
              </div>
              <span className="w-24 text-right text-sm font-bold tabular-nums text-brand-700">
                {fmt(bandFund)}
              </span>
            </div>

        </div>
      </section>

      {/* Unsplit shows */}
      {unsplitShows.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-amber-800">
              {unsplitShows.length} unsplit show{unsplitShows.length !== 1 ? 's' : ''}
            </h2>
            <Link href="/finance/split" className="text-xs font-medium text-amber-700 underline underline-offset-2 hover:text-amber-900">
              Split now →
            </Link>
          </div>
          <div className="space-y-1.5">
            {unsplitShows.map(s => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <span className="font-medium text-amber-900">{s.title}</span>
                <div className="flex items-center gap-3">
                  {s.show_date && <span className="text-amber-600">{new Date(s.show_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                  <span className="font-bold text-amber-800">{fmt(s.gross_income)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent transactions */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Recent Transactions</h2>
        {recentTxns.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
            No transactions yet. Add one above.
          </div>
        ) : (
          <div className="space-y-1">
            {recentTxns.map(t => {
              const isCredit = t.amount >= 0
              return (
                <div key={t.id} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-50">
                  <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', isCredit ? 'bg-green-100' : 'bg-red-100')}>
                    {isCredit
                      ? <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                      : <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">{t.description}</p>
                    <p className="text-xs text-gray-400">
                      {nameOf(t.member_id)} · {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </p>
                  </div>
                  <span className={cn('shrink-0 text-sm font-bold tabular-nums', isCredit ? 'text-green-600' : 'text-red-500')}>
                    {sign(t.amount)}{fmt(t.amount)}
                  </span>
                  <DeleteTransactionButton id={t.id} />
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
