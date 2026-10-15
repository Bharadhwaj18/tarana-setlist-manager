import { redirect } from 'next/navigation'
import { getSettingsContext, getSettingsMembers, getUsedTags } from '@/lib/settings-data'
import { getCachedAllProfiles, getCachedFinanceSettings } from '@/lib/data'
import { SettingsHeader } from '@/components/settings/SettingsHeader'
import { MoneySettings } from '@/components/finance/MoneySettings'

export default async function MoneySettingsPage() {
  const s = await getSettingsContext()
  // Money settings are for admins only, always.
  if (!s.isAdmin) redirect('/settings')
  const [financeSettings, tagsInUse, members, profiles] = await Promise.all([
    getCachedFinanceSettings(),
    getUsedTags(s.workspace.id),
    s.isPersonal ? Promise.resolve([]) : getSettingsMembers(),
    getCachedAllProfiles(),
  ])
  const people = s.isPersonal
    ? profiles.map(p => ({ id: p.id, name: p.display_name?.trim() || 'You' }))
    : members.map(m => ({ id: m.userId, name: m.name }))
  return (
    <>
      <SettingsHeader eyebrow={s.isPersonal ? 'Personal space' : s.workspace.name} title="Money" />
      <div className="max-w-3xl"><MoneySettings initial={financeSettings} members={people} canEdit usedTags={tagsInUse} /></div>
    </>
  )
}
