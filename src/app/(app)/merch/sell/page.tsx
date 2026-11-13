import { getCachedAllProfiles, getCachedMerch, getCachedShows, getCachedUser } from '@/lib/data'
import { redirect } from 'next/navigation'
import { getWorkspaceContext, merchScopeOf } from '@/lib/workspace'
import { sectionGuard } from '@/lib/section-guard'
import { SellView } from '@/components/merch/SellView'

export default async function MerchSellPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  // Merch crew sell from the kits they're on, not from the whole stock.
  const scopeCtx = await getWorkspaceContext()
  if (scopeCtx && merchScopeOf(scopeCtx.current) === 'crew') redirect('/merch')
  const denied = await sectionGuard('merch')
  if (denied) return denied
  const [{ show }, ctx, merch, shows, profiles, { data: { user } }] = await Promise.all([
    searchParams, getWorkspaceContext(), getCachedMerch(), getCachedShows(), getCachedAllProfiles(), getCachedUser(),
  ])

  return (
    <SellView
      items={merch.items.filter(i => !i.archived_at)}
      variants={merch.variants.filter(v => !v.archived_at)}
      moves={merch.moves}
      sales={merch.sales}
      shows={shows.map(s => ({ id: s.id, title: s.title, show_date: s.show_date }))}
      members={profiles.map(p => ({ id: p.id, name: p.id === user?.id ? 'You' : (p.display_name?.trim() || 'Member') }))}
      userId={user?.id ?? ''}
      initialShowId={shows.some(s => s.id === show) ? show! : ''}
      canEdit={ctx?.current.sections.merch === 'edit'}
    />
  )
}
