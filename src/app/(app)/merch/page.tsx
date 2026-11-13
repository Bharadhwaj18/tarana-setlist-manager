import { getCachedAllProfiles, getCachedFinanceAccounts, getCachedFinanceSettings, getCachedMerch, getCachedShows, getCachedUser } from '@/lib/data'
import { getWorkspaceContext, isMerchApprover } from '@/lib/workspace'
import { sectionGuard } from '@/lib/section-guard'
import { MerchView } from '@/components/merch/MerchView'

export default async function MerchPage() {
  const denied = await sectionGuard('merch')
  if (denied) return denied
  const [ctx, merch, shows, profiles, settings, accounts, { data: { user } }] = await Promise.all([
    getWorkspaceContext(), getCachedMerch(), getCachedShows(), getCachedAllProfiles(), getCachedFinanceSettings(), getCachedFinanceAccounts(), getCachedUser(),
  ])

  return (
    <MerchView
      items={merch.items}
      variants={merch.variants}
      moves={merch.moves}
      batches={merch.batches}
      sales={merch.sales}
      shows={shows.map(s => ({ id: s.id, title: s.title, show_date: s.show_date }))}
      members={profiles.map(p => ({ id: p.id, name: p.id === user?.id ? 'You' : (p.display_name?.trim() || 'Member') }))}
      accounts={settings.features.accounts ? accounts.filter(a => !a.archived).map(a => ({ id: a.id, name: a.name })) : []}
      canEdit={ctx?.current.sections.merch === 'edit'}
      canApprove={!!ctx && isMerchApprover(ctx.current)}
      userId={user?.id ?? ''}
    />
  )
}
