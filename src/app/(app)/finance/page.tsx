import Link from 'next/link'
import { sectionGuard } from '@/lib/section-guard'
import { createClient } from '@/lib/supabase/server'
import { getCachedAllProfiles, getCachedUser, getCachedPendingPayments, getCachedFinanceSettings, getCachedFinanceProjects, getCachedRecurring } from '@/lib/data'
import { catchUpRecurring } from '@/lib/finance/recurring-server'
import { categoryLabel, REIMBURSEMENT_KEY } from '@/lib/finance/settings'
import { FinanceExtrasProvider } from '@/components/finance/FinanceSettingsContext'
import { WaitingToBePaid } from '@/components/finance/WaitingToBePaid'
import { FolderKanban, PieChart, Repeat, Settings2 } from 'lucide-react'
import { getWorkspaceContext } from '@/lib/workspace'
import { todayISO, isUpcoming } from '@/lib/shows'
import { AddTransactionModal } from '@/components/finance/AddTransactionModal'
import { TransactionRow } from '@/components/finance/TransactionRow'
import { ExportModal } from '@/components/finance/ExportModal'
import { ReimburseButton } from '@/components/finance/ReimburseButton'
import { PendingPaymentsBanner } from '@/components/finance/PendingPaymentsBanner'
import { BudgetsSection } from '@/components/finance/BudgetsSection'
import { fmt, fmtSigned, BAR_FILL, DEBIT_TEXT } from '@/components/finance/money'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { EmptyState } from '@/components/ui/EmptyState'
import { computeBudgetProgress, unallocatedFund } from '@/lib/finance/budgets'
import { isCurrentTreasurer, requireWorkspaceId } from '@/lib/workspace'
import { cn } from '@/lib/utils'

export default async function FinancePage() {
  const denied = await sectionGuard('finance')
  if (denied) return denied
  const supabase = await createClient()
  const ws = await requireWorkspaceId()

  // Add any repeating entries that have come due since Finance was last opened, before reading.
  const [settings, projects, recurring, ctx] = await Promise.all([getCachedFinanceSettings(), getCachedFinanceProjects(), getCachedRecurring(), getWorkspaceContext()])
  if (settings.features.recurring) await catchUpRecurring(recurring)
  const currency = settings.currency
  const canEditSettings = ctx?.current.role === 'owner' || ctx?.current.role === 'admin'

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
    if (!t.member_id || t.category === REIMBURSEMENT_KEY) continue
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

  const showTitleById = Object.fromEntries((shows ?? []).map(s => [s.id, s.title]))
  const categoryText = (c: string) => categoryLabel(settings, c)
  const knownTags = [...new Set((txns ?? []).flatMap(t => t.tags ?? []))]

  // Past shows with a fee that hasn't been marked received yet.
  const waiting = settings.features.receivables
    ? (shows ?? [])
        .filter(s => s.fee != null && s.fee > 0 && !s.fee_received && s.show_date && s.show_date <= today)
        .sort((a, b) => (a.show_date ?? '').localeCompare(b.show_date ?? ''))
        .map(s => ({ id: s.id, title: s.title, date: s.show_date!, fee: s.fee!, received: Math.max(0, (txns ?? []).filter(t => t.show_id === s.id && t.amount > 0).reduce((sum, t) => sum + t.amount, 0)) }))
    : []

  const tools = [
    settings.features.projects && { href: '/finance/projects', label: 'Projects', icon: FolderKanban },
    settings.features.recurring && { href: '/finance/recurring', label: 'Repeating', icon: Repeat },
    { href: '/finance/reports', label: 'Reports', icon: PieChart },
  ].filter(Boolean) as { href: string; label: string; icon: typeof PieChart }[]

  const budgetProgress = (budgets ?? []).map(b => computeBudgetProgress(b, txns ?? [], today))
  const unallocated = unallocatedFund(memberTotal, budgetProgress)
  const isTreasurer = await isCurrentTreasurer()
  const memberNames = Object.fromEntries(profiles.map(p => [p.id, p.display_name ?? 'Member']))

  const memberOptions = profiles.map(p => ({ id: p.id, name: p.id === user?.id ? 'You' : (p.display_name ?? 'Member') }))
  const myPendingPayments = user ? pendingPayments.filter(p => p.from_member === user.id) : []

  return (
    <FinanceExtrasProvider projects={projects} knownTags={knownTags}>
    <div className="space-y-5">
      <PageHeader
        title="Finance"
        subtitle={<>{settings.fundName} <b className="text-gray-900">{fmtSigned(memberTotal, currency)}</b> · {members.length} member{members.length !== 1 ? 's' : ''}</>}
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link href="/finance/history" className="inline-flex items-center rounded-md border border-brand-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-brand-50 lg:hidden">
              History
            </Link>
            <ExportModal members={profiles.map(p => ({ id: p.id, name: p.display_name ?? 'Member' }))} />
            {canEditSettings && (
              <Link href="/workspace?tab=money" aria-label="Money settings" title="Money settings" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-brand-200 bg-white text-gray-600 hover:bg-brand-50">
                <Settings2 className="h-4 w-4" />
              </Link>
            )}
            <div className="hidden lg:block">
              <AddTransactionModal members={memberOptions} shows={shows ?? []} budgets={budgets ?? []} />
            </div>
          </div>
        }
      />
      <AddTransactionModal fab members={memberOptions} shows={shows ?? []} budgets={budgets ?? []} />

      {/* Pending payments — a standing reminder until marked paid */}
      <PendingPaymentsBanner payments={myPendingPayments} profiles={profiles} />

      <nav aria-label="Money tools" className="flex flex-wrap gap-2">
        {tools.map(t => (
          <Link key={t.href} href={t.href} className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-brand-50">
            <t.icon className="h-4 w-4 text-brand-600" /> {t.label}
          </Link>
        ))}
      </nav>

      {waiting.length > 0 && <WaitingToBePaid shows={waiting} />}

      <div className="grid items-start gap-4 lg:grid-cols-[1.1fr_1fr]">
        {/* Balances */}
        <section className="rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
          <SectionLabel className="mb-4">Member balances</SectionLabel>
          <div className="space-y-4">
            {members.map((m, i) => (
              <div key={m.id}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-gray-800">{m.name}</span>
                  <span className={cn('shrink-0 text-sm font-extrabold tabular-nums', m.balance < 0 ? DEBIT_TEXT : 'text-gray-900')}>
                    {fmtSigned(m.balance, currency)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={cn('h-full rounded-full', m.balance >= 0 ? BAR_FILL : 'bg-red-500')}
                    style={{ width: `${Math.round((Math.abs(m.balance) / maxBal) * 100)}%`, opacity: m.balance >= 0 ? Math.max(0.5, 1 - i * 0.15) : 1 }}
                  />
                </div>
                {m.balance < 0 && (() => {
                  const incoming = pendingPayments.filter(p => p.to_member === m.id && p.category === 'balance_reimbursement')
                  const covered = incoming.reduce((s, p) => s + p.amount, 0)
                  return (
                    <div className="mt-1">
                      <p className="text-[11px] font-bold text-red-700">
                        {incoming.length > 0
                          ? `${fmt(covered, currency)} assigned: ${incoming.map(p => nameOf(p.from_member)).join(', ')}`
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
      </div>

      {/* Unsplit shows */}
      {unsplitShows.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-sans text-sm font-extrabold">
              {unsplitShows.length} unsplit show{unsplitShows.length !== 1 ? 's' : ''}
            </h2>
            <Link href="/finance/split" className="text-sm font-extrabold hover:underline">
              Split now →
            </Link>
          </div>
          <div className="space-y-1.5">
            {unsplitShows.map(s => {
              const net = netForShow(s.id)
              return (
                <div key={s.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-semibold">{s.title}</span>
                  <div className="flex shrink-0 items-center gap-4">
                    {s.show_date && <span className="text-amber-700">{new Date(s.show_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                    <span className={cn('font-extrabold tabular-nums', net < 0 && DEBIT_TEXT)}>
                      {fmtSigned(net, currency)}
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
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <SectionLabel>Recent entries</SectionLabel>
          <div className="flex gap-4 text-sm font-extrabold text-brand-400 dark:text-emerald-400">
            <Link href="/finance/history" className="hover:underline">History →</Link>
            <Link href="/finance/split-history" className="hover:underline">Split history →</Link>
          </div>
        </div>
        {recentTxns.length === 0 ? (
          <EmptyState title="Nothing recorded yet" description="Add money in or out with the Add entry button." />
        ) : (
          <div className="divide-y divide-brand-100 overflow-hidden rounded-2xl border border-brand-200 bg-white">
            {recentTxns.map(t => (
              <TransactionRow
                key={t.id}
                transaction={t}
                members={memberOptions}
                shows={shows ?? []}
                budgets={budgets ?? []}
                payerName={nameOf(t.member_id)}
                badge={
                  t.show_id && showTitleById[t.show_id]
                    ? { label: showTitleById[t.show_id], kind: 'show' }
                    : t.category ? { label: categoryText(t.category), kind: 'category' } : undefined
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
    </FinanceExtrasProvider>
  )
}
