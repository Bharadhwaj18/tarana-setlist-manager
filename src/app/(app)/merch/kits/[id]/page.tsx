import { notFound } from 'next/navigation'
import { NoAccess } from '@/components/layout/NoAccess'
import { getCachedAllProfiles, getCachedFinanceAccounts, getCachedFinanceSettings, getCachedMerchCrewIds, getCachedMerchKit, getCachedUser } from '@/lib/data'
import { crewPickerPeople } from '@/lib/merch-people'
import { getWorkspaceContext, isMerchApprover, merchScopeOf } from '@/lib/workspace'
import { kitSoldByVariant, variantPrice } from '@/lib/merch'
import { KitView, type KitLineView } from '@/components/merch/KitView'

type Joined = { id: string; label: string; price: number | null; position: number; item: { id: string; name: string; price: number; position: number } | { id: string; name: string; price: number; position: number }[] | null } | null

export default async function MerchKitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getWorkspaceContext()
  if (!ctx) notFound()
  const scope = merchScopeOf(ctx.current)
  if (scope === 'none') return <NoAccess section="Merch" workspaceName={ctx.current.workspace.name} />

  const [data, profiles, { data: { user } }, settings, accounts, crewIds] = await Promise.all([
    getCachedMerchKit(id), getCachedAllProfiles(), getCachedUser(), getCachedFinanceSettings(), getCachedFinanceAccounts(), getCachedMerchCrewIds(),
  ])
  if (!data || !user) notFound()
  const { kit, show, sales, moves } = data

  const sold = kitSoldByVariant(kit.id, moves)
  const lines: KitLineView[] = data.lines
    .map(l => {
      const v = l.variant as Joined
      const item = Array.isArray(v?.item) ? v?.item[0] : v?.item
      return {
        variantId: l.variant_id,
        itemName: item?.name ?? 'Item',
        label: v?.label ?? '',
        order: [item?.position ?? 0, v?.position ?? 0] as [number, number],
        taken: l.taken,
        price: l.price != null ? Number(l.price) : variantPrice({ price: Number(item?.price ?? 0) }, { price: v?.price ?? null }),
        returned: l.returned,
        given: l.given,
        lost: l.lost,
        sold: sold.get(l.variant_id) ?? 0,
      }
    })
    .sort((a, b) => a.order[0] - b.order[0] || a.itemName.localeCompare(b.itemName) || a.order[1] - b.order[1])

  const onKit = kit.lead_id === user.id || kit.helper_ids.includes(user.id)
  const canEdit = scope === 'full' && ctx.current.sections.merch === 'edit'
  const approver = isMerchApprover(ctx.current)
  const nameOf = (uid: string | null) => (uid === user.id ? 'You' : profiles.find(p => p.id === uid)?.display_name?.trim() || 'Member')

  return (
    <KitView
      kit={kit}
      show={show}
      lines={lines}
      sales={sales}
      people={{ lead: kit.lead_id ? nameOf(kit.lead_id) : null, helpers: kit.helper_ids.map(nameOf), nameOf: Object.fromEntries(profiles.map(p => [p.id, nameOf(p.id)])) }}
      userId={user.id}
      can={{ sell: onKit || canEdit, pack: approver, approve: approver, fullView: scope === 'full' }}
      members={profiles.map(p => ({ id: p.id, name: nameOf(p.id) }))}
      crewPeople={approver ? crewPickerPeople(profiles.map(p => ({ id: p.id, name: nameOf(p.id) })), crewIds) : []}
      accounts={settings.features.accounts ? accounts.filter(a => !a.archived).map(a => ({ id: a.id, name: a.name })) : []}
    />
  )
}
