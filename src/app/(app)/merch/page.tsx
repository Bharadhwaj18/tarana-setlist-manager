import { getCachedMerch, getCachedShows } from '@/lib/data'
import { getWorkspaceContext } from '@/lib/workspace'
import { sectionGuard } from '@/lib/section-guard'
import { MerchView } from '@/components/merch/MerchView'

export default async function MerchPage() {
  const denied = await sectionGuard('merch')
  if (denied) return denied
  const [ctx, merch, shows] = await Promise.all([getWorkspaceContext(), getCachedMerch(), getCachedShows()])

  return (
    <MerchView
      items={merch.items}
      variants={merch.variants}
      moves={merch.moves}
      batches={merch.batches}
      shows={shows.map(s => ({ id: s.id, title: s.title, show_date: s.show_date }))}
      canEdit={ctx?.current.sections.merch === 'edit'}
    />
  )
}
