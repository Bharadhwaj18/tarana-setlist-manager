import { notFound } from 'next/navigation'
import { NoAccess } from '@/components/layout/NoAccess'
import { KitForm, type PackRow } from '@/components/merch/KitForm'
import { getCachedAllProfiles, getCachedMerch, getCachedMerchCrewIds, getCachedShows, getCachedUser } from '@/lib/data'
import { crewPickerPeople } from '@/lib/merch-people'
import { getWorkspaceContext, isMerchApprover } from '@/lib/workspace'
import { kitSoldByVariant, outInKits, statsByVariant, statsFor, variantPrice } from '@/lib/merch'

/** The packing page, for a new kit (kitId null) or an open one being edited. Admins and the Merch role only. */
export async function PackKitPage({ kitId, showId }: { kitId: string | null; showId?: string }) {
  const ctx = await getWorkspaceContext()
  if (!ctx) notFound()
  if (!isMerchApprover(ctx.current)) return <NoAccess section="Packing merch kits" workspaceName={ctx.current.workspace.name} />

  const [merch, shows, profiles, { data: { user } }, crewIds] = await Promise.all([getCachedMerch(), getCachedShows(), getCachedAllProfiles(), getCachedUser(), getCachedMerchCrewIds()])
  const kit = kitId ? merch.kits.find(k => k.id === kitId) : null
  if (kitId && !kit) notFound()
  if (kit && kit.status !== 'open') return <NoAccess section="This kit (it’s closed; reopen it first)" workspaceName={ctx.current.workspace.name} />

  const stats = statsByVariant(merch.moves)
  const out = outInKits(merch.kits.filter(k => k.id !== kitId), merch.kitLines, merch.moves)
  const sold = kitId ? kitSoldByVariant(kitId, merch.moves) : new Map<string, number>()
  const mine = new Map(merch.kitLines.filter(l => l.kit_id === kitId).map(l => [l.variant_id, l]))
  const liveItems = merch.items.filter(i => !i.archived_at)

  const rows: PackRow[] = liveItems.flatMap(item =>
    merch.variants
      .filter(v => v.item_id === item.id && (!v.archived_at || mine.has(v.id)))
      .map(v => {
        const s = sold.get(v.id) ?? 0
        return {
          variantId: v.id,
          itemName: item.name,
          label: v.label,
          price: variantPrice(item, v),
          available: Math.max(0, statsFor(stats, v.id).stock - (out.get(v.id) ?? 0) + s),
          sold: s,
          taken: mine.get(v.id)?.taken ?? 0,
          showPrice: mine.get(v.id)?.price ?? null,
        }
      })
      .filter(r => r.available > 0 || r.taken > 0),
  )

  // Shows that don't have a kit yet (plus this kit's own show).
  const usedShows = new Set(merch.kits.filter(k => k.id !== kitId).map(k => k.show_id))
  const showOptions = shows.filter(s => !usedShows.has(s.id)).map(s => ({ id: s.id, title: s.title, show_date: s.show_date, venue: s.venue }))

  return (
    <KitForm
      kitId={kitId}
      shows={showOptions}
      members={crewPickerPeople(profiles.map(p => ({ id: p.id, name: p.id === user?.id ? 'You' : (p.display_name?.trim() || 'Member') })), crewIds)}
      rows={rows}
      initial={{
        showId: kit?.show_id ?? (showId && showOptions.some(s => s.id === showId) ? showId : ''),
        leadId: kit?.lead_id ?? '',
        helperIds: kit?.helper_ids ?? [],
        notes: kit?.notes ?? '',
      }}
    />
  )
}
