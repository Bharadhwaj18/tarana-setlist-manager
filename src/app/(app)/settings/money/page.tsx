import { redirect } from 'next/navigation'
import { getSettingsContext, getSettingsMembers, getUsedTags } from '@/lib/settings-data'
import { getCachedAllProfiles, getCachedFinanceAccounts, getCachedFinanceSettings } from '@/lib/data'
import { createClient } from '@/lib/supabase/server'
import { AccountsManager } from '@/components/finance/AccountsManager'
import { SettingsHeader } from '@/components/settings/SettingsHeader'
import { MoneySettings } from '@/components/finance/MoneySettings'

export default async function MoneySettingsPage() {
  const s = await getSettingsContext()
  // Money settings are for admins only, always.
  if (!s.isAdmin) redirect('/settings')
  const [financeSettings, tagsInUse, members, profiles, accounts] = await Promise.all([
    getCachedFinanceSettings(),
    getUsedTags(s.workspace.id),
    s.isPersonal ? Promise.resolve([]) : getSettingsMembers(),
    getCachedAllProfiles(),
    getCachedFinanceAccounts(),
  ])
  // What each account holds and how many entries it has, so the page can say what can be deleted.
  const balances: Record<string, number> = {}
  const entryCounts: Record<string, number> = {}
  if (financeSettings.features.accounts) {
    const supabase = await createClient()
    const { data: rows } = await supabase.from('finance_transactions').select('account_id, amount').eq('workspace_id', s.workspace.id).not('account_id', 'is', null)
    for (const r of rows ?? []) {
      if (!r.account_id) continue
      balances[r.account_id] = Math.round(((balances[r.account_id] ?? 0) + r.amount) * 100) / 100
      entryCounts[r.account_id] = (entryCounts[r.account_id] ?? 0) + 1
    }
  }
  const people = s.isPersonal
    ? profiles.map(p => ({ id: p.id, name: p.display_name?.trim() || 'You' }))
    : members.map(m => ({ id: m.userId, name: m.name }))
  return (
    <>
      <SettingsHeader eyebrow={s.isPersonal ? 'Personal space' : s.workspace.name} title="Money" />
      <div className="max-w-3xl space-y-5">
        <MoneySettings initial={financeSettings} members={people} canEdit usedTags={tagsInUse} />
        {financeSettings.features.accounts && (
          <AccountsManager accounts={accounts} members={people} balances={balances} entryCounts={entryCounts} currency={financeSettings.currency} />
        )}
      </div>
    </>
  )
}
