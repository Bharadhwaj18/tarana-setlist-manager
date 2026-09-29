import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCachedAllProfiles, getCachedUser, getCachedPendingPayments } from '@/lib/data'
import { todayISO, isUpcoming } from '@/lib/shows'
import { AddTransactionModal } from '@/components/finance/AddTransactionModal'
import { TransactionRow } from '@/components/finance/TransactionRow'
import { ExportModal } from '@/components/finance/ExportModal'
import { FinanceFloatingNav } from '@/components/finance/FinanceFloatingNav'
import { ReimburseButton } from '@/components/finance/ReimburseButton'
import { PendingPaymentsBanner } from '@/components/finance/PendingPaymentsBanner'
import { BudgetsSection } from '@/components/finance/BudgetsSection'
import { computeBudgetProgress, unallocatedFund } from '@/lib/finance/budgets'
import { isCurrentTreasurer, requireWorkspaceId } from '@/lib/workspace'
import { cn } from '@/lib/utils'

function fmt(n: number) {
  return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export default async function FinancePage() {
  const supabase = await createClient()
  const ws = await requireWorkspaceId()

  const [{ data: { user } }, profiles, { data: txns }, { data: shows }, pendingPayments, { data: budgets }] = await Promise.all([
    getCachedUser(),
    getCachedAllProfiles(),
    supabase.from('finance_transactions').select('*').eq('workspace_id', ws).order('created_at', { ascending: false }),
    supabase.from('shows').select('*').eq('workspace_id', ws).order('show_date', { ascending: false }),
    getCachedPendingPayments(),
    supabase.from('budgets').select('*').eq('workspace_id', ws).order('created_at', { ascending: true }),
  ])

  // Balance per member. There's no separate Band Fund bucket — whatever a
  // member is holding, including a retained Band Fund cut from a split, is
  // just their balance, same as anything else. category:'reimbursement' is
  // the one exception — it's a personal cost they fronted (fuel, etc.),
  // never Band Fund money in the first place, so it never touches this
  // balance; the split pays it back to them directly (funded by whoever's
  // assigned to cover it), same as their cut becoming personal money the
  // moment it's paid.
  const balanceMap: Record<string, number> = {}
  for (const t of txns ?? []) {
    if (!t.member_id || t.category === 'reimbursement') continue
    balanceMap[t.member_id] = (balanceMap[t.member_id] ?? 0) + t.amount
  }

  const members = profiles.map(p => ({
    id: p.id,
    name: p.id === user?.id ? 'You' : (p.display_name ?? 'Member'),
    balance: balanceMap[p.id] ?? 0,
  })).sort((a, b) => b.balance - a.balance)

  const memberTotal = members.reduce((s, m) => s + m.balance, 0)
  const maxBal = Math.max(...members.map(m => Math.abs(m.balance)), 1)

  const netForShow = (showId: string) =>
    (txns ?? []).filter(t => t.show_id === showId).reduce((s, t) => s + t.amount, 0)

  // A show that hasn't happened yet has nothing to split — keep it out of
  // this "needs splitting" reminder (and the Split screen's picker below)
  // until its date arrives.
  const today = todayISO()
  const unsplitShows = (shows ?? []).filter(s => !s.split_at && !isUpcoming(s.show_date, today))
  const recentTxns = (txns ?? []).slice(0, 15)
  const nameOf = (id: string | null) =>
    id === null ? 'Unattributed' : id === user?.id ? 'You' : (profiles.find(p => p.id === id)?.display_name ?? 'Member')

  const budgetProgress = (budgets ?? []).map(b => computeBudgetProgress(b, txns ?? [], today))
  const unallocated = unallocatedFund(memberTotal, budgetProgress)
  const isTreasurer = await isCurrentTreasurer()
  const memberNames = Object.fromEntries(profiles.map(p => [p.id, p.display_name ?? 'Member']))

  const memberOptions = profiles.map(p => ({ id: p.id, name: p.id === user?.id ? 'You' : (p.display_name ?? 'Member') }))
  const myPendingPayments = user ? pendingPayments.filter(p => p.from_member === user.id) : []

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finance</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Total band fund: <span className="font-semibold text-gray-800">{fmt(memberTotal)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AddTransactionModal members={memberOptions} shows={shows ?? []} budgets={budgets ?? []} />
          <ExportModal members={profiles.map(p => ({ id: p.id, name: p.display_name ?? 'Member' }))} />
        </div>
      </div>

      {/* Pending payments — a standing reminder until marked paid */}
      <PendingPaymentsBanner payments={myPendingPayments} profiles={profiles} />

      {/* Balances */}
      <section className="rounded-xl border border-brand-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Member Balances</h2>
        <div className="space-y-3">
          {members.map(m => (
            <div key={m.id}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-gray-700">{m.name}</span>
                <span className={cn('shrink-0 text-sm font-bold tabular-nums', m.balance < 0 ? 'text-red-600' : 'text-gray-800')}>
                  {m.balance < 0 ? '−' : ''}{fmt(m.balance)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className={cn('h-full rounded-full', m.balance >= 0 ? 'bg-brand-400' : 'bg-red-400')}
                  style={{ width: `${Math.round((Math.abs(m.balance) / maxBal) * 100)}%` }}
                />
              </div>
              {m.balance < 0 && (() => {
                const incoming = pendingPayments.filter(p => p.to_member === m.id && p.category === 'balance_reimbursement')
                const covered = incoming.reduce((s, p) => s + p.amount, 0)
                return (
                  <div className="mt-0.5">
                    <p className="text-[10px] font-medium text-red-500">
                      {incoming.length > 0
                        ? `${fmt(covered)} assigned: ${incoming.map(p => nameOf(p.from_member)).join(', ')}`
                        : 'Reimbursement pending'}
                    </p>
                    {-m.balance - covered > 0.005 && <ReimburseButton memberId={m.id} payers={memberOptions} />}
                  </div>
                )
              })()}
            </div>
          ))}
        </div>
      </section>

      <BudgetsSection progress={budgetProgress} unallocated={unallocated} isTreasurer={isTreasurer} memberNames={memberNames} />

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
            {unsplitShows.map(s => {
              const net = netForShow(s.id)
              return (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-amber-900">{s.title}</span>
                  <div className="flex items-center gap-3">
                    {s.show_date && <span className="text-amber-600">{new Date(s.show_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                    <span className={cn('font-bold tabular-nums', net < 0 ? 'text-red-600' : 'text-amber-800')}>
                      {net < 0 ? '−' : ''}{fmt(net)}
                    </span>
                  </div>
                </div>
              )
            })}
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
            {recentTxns.map(t => (
              <TransactionRow
                key={t.id}
                transaction={t}
                members={memberOptions}
                shows={shows ?? []}
                budgets={budgets ?? []}
                payerName={nameOf(t.member_id)}
              />
            ))}
          </div>
        )}
      </section>

      <FinanceFloatingNav hasUnsplitShows={unsplitShows.length > 0} />
    </div>
  )
}
