// Server only: uses the service-role client.
import { createServiceClient } from '@/lib/supabase/service'
import { sendPushToProfile } from '@/lib/push'
import { todayISO } from '@/lib/shows'
import { crossedLowStock } from '@/lib/merch'

/**
 * Tells the workspace's merch approvers (owners, admins, Merch role) when sizes run low after stock went out.
 * `changes` is what just happened per variant (negative = stock out).
 *
 * Runs with the service client because crew can't read stock levels or the member list, yet their sales can be
 * what tips a size over. It only ever reads stock and writes these notifications. One notice per size per day.
 * Never throws: an alert failing must not fail the sale.
 */
export async function notifyLowStock(workspaceId: string, actorId: string, changes: Map<string, number>) {
  try {
    const ids = [...changes.entries()].filter(([, d]) => d < 0).map(([id]) => id)
    if (!ids.length) return
    const supabase = createServiceClient()
    const [{ data: variants }, { data: moves }] = await Promise.all([
      supabase.from('merch_variants').select('id, label, low_stock_at, archived_at, item:merch_items(name)').in('id', ids).eq('workspace_id', workspaceId),
      supabase.from('merch_stock_moves').select('variant_id, qty').in('variant_id', ids).eq('workspace_id', workspaceId),
    ])
    const stock = new Map<string, number>()
    for (const m of moves ?? []) stock.set(m.variant_id, (stock.get(m.variant_id) ?? 0) + m.qty)

    const low = (variants ?? []).filter(v => !v.archived_at && crossedLowStock(stock.get(v.id) ?? 0, changes.get(v.id) ?? 0, v.low_stock_at))
    if (!low.length) return

    const { data: members } = await supabase.from('workspace_members').select('user_id, role, permissions').eq('workspace_id', workspaceId)
    const approvers = (members ?? [])
      .filter(m => m.role === 'owner' || m.role === 'admin' || (m.permissions as Record<string, unknown> | null)?.merch_manager === true)
      .map(m => m.user_id)
    if (!approvers.length) return

    const today = todayISO()
    const rows = low.flatMap(v => {
      const name = `${(Array.isArray(v.item) ? v.item[0] : v.item)?.name ?? 'Merch'} ${v.label}`
      const left = stock.get(v.id) ?? 0
      return approvers.map(recipient_id => ({
        recipient_id,
        sender_id: actorId,
        workspace_id: workspaceId,
        title: left <= 0 ? `Sold out: ${name}` : `Running low: ${name}`,
        body: left <= 0 ? 'Time to restock.' : `${left} left (you asked to be warned at ${v.low_stock_at}).`,
        link: '/merch',
        type: 'merch_low_stock',
        dedupe_key: `merch_low:${v.id}:${today}:${recipient_id}`,
      }))
    })
    const { data: inserted } = await supabase.from('notifications').upsert(rows, { onConflict: 'dedupe_key', ignoreDuplicates: true }).select('recipient_id, title, body, link')
    await Promise.allSettled((inserted ?? []).map(n => sendPushToProfile(n.recipient_id, { title: n.title, body: n.body, link: n.link })))
  } catch {
    // The sale already happened; a missed alert is the lesser problem.
  }
}

/**
 * Low-stock check after a kit is closed (its close-out sale) or approved (its giveaways and losses): those are the
 * stock moves the database function just wrote.
 */
export async function notifyLowStockForKit(workspaceId: string, actorId: string, kitId: string, step: 'close' | 'approve') {
  try {
    const supabase = createServiceClient()
    let query = supabase.from('merch_stock_moves').select('variant_id, qty').eq('kit_id', kitId)
    if (step === 'approve') query = query.in('reason', ['giveaway', 'damaged'])
    else {
      const { data: closeOut } = await supabase.from('merch_sales').select('id').eq('kit_id', kitId).eq('mode', 'count')
      if (!closeOut?.length) return
      query = query.in('sale_id', closeOut.map(c => c.id))
    }
    const { data } = await query
    const changes = new Map<string, number>()
    for (const m of data ?? []) changes.set(m.variant_id, (changes.get(m.variant_id) ?? 0) + m.qty)
    await notifyLowStock(workspaceId, actorId, changes)
  } catch {
    // See notifyLowStock.
  }
}
