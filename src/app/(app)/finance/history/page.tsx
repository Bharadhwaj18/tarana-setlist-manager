import Link from 'next/link'
import { sectionGuard } from '@/lib/section-guard'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspaceId } from '@/lib/workspace'
import { getCachedAllProfiles, getCachedUser } from '@/lib/data'
import { FinanceHistoryList } from '@/components/finance/FinanceHistoryList'
import { ExportModal } from '@/components/finance/ExportModal'
import { PageHeader } from '@/components/ui/PageHeader'

export default async function FinanceHistoryPage() {
  const denied = await sectionGuard('finance')
  if (denied) return denied
  const supabase = await createClient()
  const ws = await requireWorkspaceId()

  const [{ data: { user } }, profiles, { data: txns }, { data: shows }, { data: budgets }] = await Promise.all([
    getCachedUser(),
    getCachedAllProfiles(),
    // Sorted by when it was actually recorded, not the (user-editable, can
    // be backdated) `date` field — otherwise "latest at top" doesn't match
    // what you just did if any entry has a different logical date.
    supabase.from('finance_transactions').select('*').eq('workspace_id', ws).order('created_at', { ascending: false }),
    supabase.from('shows').select('*').eq('workspace_id', ws),
    supabase.from('budgets').select('*').eq('workspace_id', ws).order('created_at', { ascending: false }),
  ])

  const members = profiles.map(p => ({
    id: p.id,
    name: p.id === user?.id ? 'You' : (p.display_name ?? 'Member'),
  }))

  const showTitleById = Object.fromEntries((shows ?? []).map(s => [s.id, s.title]))

  const historyTxns = txns ?? []

  // Running "after this transaction" band fund snapshot for every transaction.
  // Processed oldest→newest so each entry reflects real state at that moment.
  // category:'reimbursement' is excluded from band fund balances (same rule
  // as the Finance page's Member Balances panel).
  const allChron = [...(txns ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  let runningTotal = 0
  const runningMember: Record<string, number> = {}
  const runningBalances: Record<string, { total: number; memberBalance: number | null }> = {}
  for (const t of allChron) {
    if (t.category !== 'reimbursement' && t.member_id) {
      runningTotal += t.amount
      runningMember[t.member_id] = (runningMember[t.member_id] ?? 0) + t.amount
    }
    runningBalances[t.id] = {
      total: runningTotal,
      memberBalance: t.member_id ? (runningMember[t.member_id] ?? 0) : null,
    }
  }

  return (
    <div>
      <Link href="/finance" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> Finance
      </Link>
      <PageHeader
        title="History"
        subtitle="Every transaction — Misc, show income, expenses, and splits."
        action={
          <div className="flex items-center gap-3">
            <Link href="/finance/split-history" className="hidden text-sm font-extrabold text-brand-400 hover:underline dark:text-emerald-400 sm:inline">
              Split history →
            </Link>
            <ExportModal members={profiles.map(p => ({ id: p.id, name: p.display_name ?? 'Member' }))} />
          </div>
        }
      />

      <FinanceHistoryList
        transactions={historyTxns}
        members={members}
        shows={shows ?? []}
        budgets={budgets ?? []}
        showTitleById={showTitleById}
        runningBalances={runningBalances}
      />
    </div>
  )
}
