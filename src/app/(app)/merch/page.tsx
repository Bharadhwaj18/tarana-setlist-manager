import { notFound } from 'next/navigation'
import { NoAccess } from '@/components/layout/NoAccess'
import { getCachedAllProfiles, getCachedFinanceAccounts, getCachedFinanceSettings, getCachedMerch, getCachedMyKits, getCachedShows, getCachedUser } from '@/lib/data'
import { getWorkspaceContext, isMerchApprover, merchScopeOf } from '@/lib/workspace'
import { MerchView } from '@/components/merch/MerchView'
import { CrewHome } from '@/components/merch/Kits'

export default async function MerchPage() {
  const ctx = await getWorkspaceContext()
  if (!ctx) notFound()
  const scope = merchScopeOf(ctx.current)
  if (scope === 'none') return <NoAccess section="Merch" workspaceName={ctx.current.workspace.name} />
  // Merch crew only ever see the kits they're on.
  if (scope === 'crew') return <CrewHome kits={await getCachedMyKits()} />

  const [merch, shows, profiles, settings, accounts, { data: { user } }] = await Promise.all([
    getCachedMerch(), getCachedShows(), getCachedAllProfiles(), getCachedFinanceSettings(), getCachedFinanceAccounts(), getCachedUser(),
  ])

  return (
    <MerchView
      items={merch.items}
      variants={merch.variants}
      moves={merch.moves}
      batches={merch.batches}
      sales={merch.sales}
      kits={merch.kits}
      kitLines={merch.kitLines}
      shows={shows.map(s => ({ id: s.id, title: s.title, show_date: s.show_date, venue: s.venue }))}
      members={profiles.map(p => ({ id: p.id, name: p.id === user?.id ? 'You' : (p.display_name?.trim() || 'Member') }))}
      accounts={settings.features.accounts ? accounts.filter(a => !a.archived).map(a => ({ id: a.id, name: a.name })) : []}
      canEdit={ctx.current.sections.merch === 'edit'}
      canApprove={isMerchApprover(ctx.current)}
      userId={user?.id ?? ''}
    />
  )
}
