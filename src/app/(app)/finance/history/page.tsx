import Link from 'next/link'
import { sectionGuard } from '@/lib/section-guard'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspaceId } from '@/lib/workspace'
import { getCachedAllProfiles, getCachedUser, getCachedFinanceProjects, getCachedFinanceAccounts, getCachedFinanceSettings } from '@/lib/data'
import { accountPickerOptions } from '@/lib/finance/accounts'
import { FinanceExtrasProvider } from '@/components/finance/FinanceSettingsContext'
import { FinanceHistoryList } from '@/components/finance/FinanceHistoryList'
import { ExportModal } from '@/components/finance/ExportModal'
import { PageHeader } from '@/components/ui/PageHeader'

export default async function FinanceHistoryPage() {
  const denied = await sectionGuard('finance')
  if (denied) return denied
  const supabase = await createClient()
  const ws = await requireWorkspaceId()

  const [{ data: { user } }, profiles, { data: txns }, { data: shows }, { data: budgets }, projects, allAccounts, settings] = await Promise.all([
    getCachedUser(),
    getCachedAllProfiles(),
    // Sorted by when it was actually recorded, not the (user-editable, can
    // be backdated) `date` field — otherwise "latest at top" doesn't match
    // what you just did if any entry has a different logical date.
    supabase.from('finance_transactions').select('*').eq('workspace_id', ws).order('created_at', { ascending: false }),
    supabase.from('shows').select('*').eq('workspace_id', ws),
    supabase.from('budgets').select('*').eq('workspace_id', ws).order('created_at', { ascending: false }),
    getCachedFinanceProjects(),
    getCachedFinanceAccounts(),
    getCachedFinanceSettings(),
  ])
  const accounts = settings.features.accounts ? allAccounts : []

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
  // A holder is a member or an account: either keeps its own running balance.
  const runningMember: Record<string, number> = {}
  const runningBalances: Record<string, { total: number; memberBalance: number | null }> = {}
  for (const t of allChron) {
    const holder = t.account_id ?? t.member_id
    if (t.category !== 'reimbursement' && holder) {
      runningTotal += t.amount
      runningMember[holder] = (runningMember[holder] ?? 0) + t.amount
    }
    runningBalances[t.id] = {
      total: runningTotal,
      memberBalance: holder ? (runningMember[holder] ?? 0) : null,
    }
  }

  return (
    <FinanceExtrasProvider projects={projects} knownTags={[...new Set(historyTxns.flatMap(t => t.tags ?? []))]} accounts={accounts}>
    <div>
      <Link href="/finance" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> Finance
      </Link>
      <PageHeader
        title="History"
        subtitle="Every entry: general money, show income, expenses and splits."
        action={
          <div className="flex items-center gap-3">
            <Link href="/finance/split-history" className="hidden text-sm font-extrabold text-brand-400 hover:underline dark:text-emerald-400 sm:inline">
              Split history →
            </Link>
            <ExportModal members={[...profiles.map(p => ({ id: p.id, name: p.display_name ?? 'Member' })), ...accountPickerOptions(accounts)]} />
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
    </FinanceExtrasProvider>
  )
}
