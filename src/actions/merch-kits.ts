'use server'

// Show kits: the box packed for one show. Admins and the Merch role pack them; the crew on a kit sell from it and
// close it at the end of the night; an approver approves it into Finance. Selling, closing, reopening and approving
// run as database functions (record_kit_sale, close_merch_kit, ...) so crew never need direct table access.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceContext, isMerchApprover, requireWorkspaceId } from '@/lib/workspace'
import { getCachedFinanceSettings } from '@/lib/data'
import { formatMoney } from '@/lib/finance/settings'
import { sendNotification } from '@/actions/notifications'
import { kitSoldByVariant, outInKits, statsByVariant, statsFor } from '@/lib/merch'

type Result = { error?: string; id?: string }

const friendly = (message: string) =>
  /merch_kits_show_id_key/.test(message) ? 'This show already has a kit. Open it instead.'
    : /row-level security|permission denied/i.test(message) ? 'You don’t have permission to do that.'
      : message

const moneyText = async (n: number) => formatMoney(n, (await getCachedFinanceSettings()).currency)

function refresh(kitId?: string | null, showId?: string | null) {
  revalidatePath('/merch')
  if (kitId) revalidatePath(`/merch/kits/${kitId}`)
  if (showId) revalidatePath(`/shows/${showId}`)
}

async function signedIn() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

async function requirePacker(): Promise<string | null> {
  const ctx = await getWorkspaceContext()
  return ctx && isMerchApprover(ctx.current) ? null : 'Only an admin or someone with the Merch role can pack kits.'
}

// ---- Packing -----------------------------------------------------------------------------------------------------

export interface KitInput {
  /** Set when editing an open kit. */
  id?: string | null
  showId: string
  leadId: string | null
  helperIds?: string[]
  notes?: string | null
  lines: { variantId: string; taken: number; price?: number | null }[]
}

/** Creates a kit for a show, or changes an open one. Never packs more than is at home. */
export async function saveMerchKit(input: KitInput): Promise<Result> {
  const { supabase, user } = await signedIn()
  if (!user) return { error: 'Not signed in' }
  const denied = await requirePacker()
  if (denied) return { error: denied }
  const workspace_id = await requireWorkspaceId()
  if (!input.showId) return { error: 'Pick the show.' }

  const lines = new Map<string, { taken: number; price: number | null }>()
  for (const l of input.lines ?? []) {
    const taken = Math.trunc(Number(l.taken))
    const price = l.price === null || l.price === undefined || (l.price as unknown) === '' ? null : Number(l.price)
    if (!l.variantId || !Number.isFinite(taken) || taken < 0) return { error: 'Enter how many of each item are going.' }
    if (price !== null && (!Number.isFinite(price) || price < 0)) return { error: 'Enter valid show prices.' }
    if (taken > 0) lines.set(l.variantId, { taken, price: price === null ? null : Math.round(price * 100) / 100 })
  }
  if (!lines.size) return { error: 'Pack at least one item.' }

  // Who's on the kit: members of this workspace only.
  const { data: members } = await supabase.from('workspace_members').select('user_id').eq('workspace_id', workspace_id)
  const memberIds = new Set((members ?? []).map(m => m.user_id))
  const lead_id = input.leadId && memberIds.has(input.leadId) ? input.leadId : null
  if (!lead_id) return { error: 'Pick who’s running the stall.' }
  const helper_ids = [...new Set((input.helperIds ?? []).filter(id => memberIds.has(id) && id !== lead_id))]

  // What's at home: stock minus what other unapproved kits still hold.
  const [{ data: moves }, { data: kits }, { data: allLines }] = await Promise.all([
    supabase.from('merch_stock_moves').select('variant_id, qty, reason, unit_cost, unit_price, kit_id').eq('workspace_id', workspace_id),
    supabase.from('merch_kits').select('id, status').eq('workspace_id', workspace_id),
    supabase.from('merch_kit_lines').select('kit_id, variant_id, taken, returned').eq('workspace_id', workspace_id),
  ])
  const stats = statsByVariant(moves ?? [])
  const otherKits = (kits ?? []).filter(k => k.id !== input.id)
  const out = outInKits(otherKits, allLines ?? [], moves ?? [])
  const soldHere = input.id ? kitSoldByVariant(input.id, moves ?? []) : new Map<string, number>()

  const { data: variants } = await supabase.from('merch_variants').select('id, label, item:merch_items(name)').in('id', [...lines.keys()]).eq('workspace_id', workspace_id)
  if ((variants ?? []).length !== lines.size) return { error: 'Some of those items are no longer there. Reload and try again.' }
  for (const v of variants ?? []) {
    const want = lines.get(v.id)!.taken
    const sold = soldHere.get(v.id) ?? 0
    // Units this kit already sold are no longer in stock, so they count back towards what it may hold.
    const available = statsFor(stats, v.id).stock - (out.get(v.id) ?? 0) + sold
    const name = `${(Array.isArray(v.item) ? v.item[0] : v.item)?.name ?? 'Item'} ${v.label}`
    if (want < sold) return { error: `${name}: ${sold} already sold from this kit, so at least ${sold} went.` }
    if (want > available) return { error: `${name}: only ${Math.max(0, available)} at home.` }
  }
  if (input.id) {
    for (const [variantId, sold] of soldHere) {
      if (sold > 0 && !lines.has(variantId)) return { error: 'An item that has already sold can’t be taken out of the kit.' }
    }
  }

  let kitId = input.id ?? null
  let previous: { lead_id: string | null; helper_ids: string[] } | null = null
  if (kitId) {
    const { data: kit } = await supabase.from('merch_kits').select('lead_id, helper_ids, status').eq('id', kitId).maybeSingle()
    if (!kit) return { error: 'That kit is no longer there.' }
    if (kit.status !== 'open') return { error: 'Only an open kit can be changed. Reopen it first.' }
    previous = kit
    const { error } = await supabase.from('merch_kits').update({ show_id: input.showId, lead_id, helper_ids, notes: input.notes?.trim() || null }).eq('id', kitId)
    if (error) return { error: friendly(error.message) }
    const { error: dError } = await supabase.from('merch_kit_lines').delete().eq('kit_id', kitId).not('variant_id', 'in', `(${[...lines.keys()].join(',')})`)
    if (dError) return { error: friendly(dError.message) }
  } else {
    const { data: kit, error } = await supabase.from('merch_kits').insert({ workspace_id, show_id: input.showId, lead_id, helper_ids, notes: input.notes?.trim() || null }).select('id').single()
    if (error) return { error: friendly(error.message) }
    kitId = kit.id
  }

  const { error: lError } = await supabase.from('merch_kit_lines').upsert(
    [...lines.entries()].map(([variant_id, l]) => ({ kit_id: kitId!, workspace_id, variant_id, taken: l.taken, price: l.price })),
    { onConflict: 'kit_id,variant_id' },
  )
  if (lError) {
    if (!input.id) await supabase.from('merch_kits').delete().eq('id', kitId!)
    return { error: friendly(lError.message) }
  }

  await tellNewCrew(supabase, user.id, kitId!, input.showId, { lead_id, helper_ids }, previous)
  refresh(kitId, input.showId)
  return { id: kitId! }
}

/** Tells anyone newly put on a kit (not the person doing it, and not anyone who was already on it). */
async function tellNewCrew(
  supabase: Awaited<ReturnType<typeof createClient>>, actorId: string, kitId: string, showId: string | null,
  now: { lead_id: string; helper_ids: string[] }, before: { lead_id: string | null; helper_ids: string[] } | null,
) {
  const already = new Set([before?.lead_id, ...(before?.helper_ids ?? [])].filter(Boolean))
  const { data: show } = showId ? await supabase.from('shows').select('title').eq('id', showId).maybeSingle() : { data: null }
  for (const recipientId of [now.lead_id, ...now.helper_ids]) {
    if (recipientId === actorId || already.has(recipientId)) continue
    await sendNotification({
      recipientId,
      title: recipientId === now.lead_id ? `You’re running merch at ${show?.title ?? 'a show'}` : `You’re helping with merch at ${show?.title ?? 'a show'}`,
      body: 'Open the kit to see what’s in the box.',
      link: `/merch/kits/${kitId}`,
      type: 'merch_kit_assigned',
    })
  }
}

/**
 * Changes who runs a kit and who helps, without touching what's in it. Works any time before the kit is closed;
 * whoever is taken off loses access straight away, and whoever is put on is told.
 */
export async function setMerchKitCrew(kitId: string, leadId: string | null, helperIds: string[] = []): Promise<Result> {
  const { supabase, user } = await signedIn()
  if (!user) return { error: 'Not signed in' }
  const denied = await requirePacker()
  if (denied) return { error: denied }
  const workspace_id = await requireWorkspaceId()

  const { data: kit } = await supabase.from('merch_kits').select('show_id, status, lead_id, helper_ids').eq('id', kitId).maybeSingle()
  if (!kit) return { error: 'That kit is no longer there.' }
  if (kit.status !== 'open') return { error: 'The crew can only be changed before the kit is closed. Reopen it first.' }

  const { data: members } = await supabase.from('workspace_members').select('user_id').eq('workspace_id', workspace_id)
  const memberIds = new Set((members ?? []).map(m => m.user_id))
  const lead_id = leadId && memberIds.has(leadId) ? leadId : null
  if (!lead_id) return { error: 'Pick who’s running the stall.' }
  const helper_ids = [...new Set(helperIds.filter(id => memberIds.has(id) && id !== lead_id))]

  const { error } = await supabase.from('merch_kits').update({ lead_id, helper_ids }).eq('id', kitId)
  if (error) return { error: friendly(error.message) }
  await tellNewCrew(supabase, user.id, kitId, kit.show_id, { lead_id, helper_ids }, kit)
  refresh(kitId, kit.show_id)
  return {}
}

/** Deletes a kit that hasn't sold anything yet. */
export async function deleteMerchKit(id: string): Promise<Result> {
  const { supabase, user } = await signedIn()
  if (!user) return { error: 'Not signed in' }
  const denied = await requirePacker()
  if (denied) return { error: denied }
  const { count } = await supabase.from('merch_sales').select('id', { count: 'exact', head: true }).eq('kit_id', id)
  if ((count ?? 0) > 0) return { error: 'This kit has sales. Undo them first, or close and approve it.' }
  const { data: kit } = await supabase.from('merch_kits').select('show_id').eq('id', id).maybeSingle()
  const { error } = await supabase.from('merch_kits').delete().eq('id', id)
  if (error) return { error: friendly(error.message) }
  refresh(null, kit?.show_id)
  return {}
}

// ---- At the show -------------------------------------------------------------------------------------------------

export async function recordKitSale(kitId: string, lines: { variantId: string; qty: number }[], paid: { cash?: number; upi?: number; card?: number }, notes?: string | null): Promise<Result> {
  const { supabase, user } = await signedIn()
  if (!user) return { error: 'Not signed in' }
  const { data, error } = await supabase.rpc('record_kit_sale', {
    p_kit: kitId,
    p_lines: lines.map(l => ({ variant_id: l.variantId, qty: Math.trunc(Number(l.qty)) })),
    p_cash: Number(paid.cash || 0), p_upi: Number(paid.upi || 0), p_card: Number(paid.card || 0),
    p_notes: notes ?? null,
  })
  if (error) return { error: friendly(error.message) }
  refresh(kitId)
  return { id: data }
}

export async function undoKitSale(saleId: string, kitId: string): Promise<Result> {
  const { supabase, user } = await signedIn()
  if (!user) return { error: 'Not signed in' }
  const { error } = await supabase.rpc('undo_kit_sale', { p_sale: saleId })
  if (error) return { error: friendly(error.message) }
  refresh(kitId)
  return {}
}

export interface KitCount { variantId: string; returned: number; given: number; lost: number }

/** End of the night: what came back, what was given away or lost, and the money handed in. */
export async function closeMerchKit(kitId: string, counts: KitCount[], paid: { cash: number; upi: number; card: number }, notes?: string | null): Promise<Result> {
  const { supabase, user } = await signedIn()
  if (!user) return { error: 'Not signed in' }
  const { error } = await supabase.rpc('close_merch_kit', {
    p_kit: kitId,
    p_counts: counts.map(c => ({ variant_id: c.variantId, returned: Math.trunc(Number(c.returned) || 0), given: Math.trunc(Number(c.given) || 0), lost: Math.trunc(Number(c.lost) || 0) })),
    p_cash: Number(paid.cash || 0), p_upi: Number(paid.upi || 0), p_card: Number(paid.card || 0),
    p_notes: notes ?? null,
  })
  if (error) return { error: friendly(error.message) }

  // Tell the approvers. Crew can't read the member list, so this runs on what the kit tells us.
  const ctx = await getWorkspaceContext()
  if (ctx) {
    const { data: approvers } = await supabase.from('workspace_members').select('user_id, role, permissions').eq('workspace_id', ctx.current.workspace.id)
    const total = Number(paid.cash || 0) + Number(paid.upi || 0) + Number(paid.card || 0)
    const { data: kit } = await supabase.rpc('my_merch_kits', { p_ws: ctx.current.workspace.id })
    const showTitle = (kit ?? []).find(k => k.id === kitId)?.show_title ?? 'a show'
    for (const m of approvers ?? []) {
      const isApprover = m.role === 'owner' || m.role === 'admin' || (m.permissions as Record<string, unknown> | null)?.merch_manager === true
      if (!isApprover || m.user_id === user.id) continue
      await sendNotification({ recipientId: m.user_id, title: `Merch kit closed: ${showTitle}`, body: `${await moneyText(total)} handed in, waiting for your approval`, link: `/merch/kits/${kitId}`, type: 'merch_kit_closed' })
    }
  }
  refresh(kitId)
  return {}
}

export async function reopenMerchKit(kitId: string): Promise<Result> {
  const { supabase, user } = await signedIn()
  if (!user) return { error: 'Not signed in' }
  const { error } = await supabase.rpc('reopen_merch_kit', { p_kit: kitId })
  if (error) return { error: friendly(error.message) }
  refresh(kitId)
  return {}
}

/** Approves a closed kit: one Finance income entry, giveaways and losses off stock, everything locked. */
export async function approveMerchKit(kitId: string, to: { memberId?: string | null; accountId?: string | null } = {}): Promise<Result> {
  const { supabase, user } = await signedIn()
  if (!user) return { error: 'Not signed in' }
  if (to.accountId && !(await getCachedFinanceSettings()).features.accounts) return { error: 'Band accounts are switched off for this workspace.' }
  const { data: kit } = await supabase.from('merch_kits').select('lead_id, show_id, cash_in, upi_in, card_in').eq('id', kitId).maybeSingle()
  const { data: txId, error } = await supabase.rpc('approve_merch_kit', { p_kit: kitId, p_member: to.memberId || null, p_account: to.accountId || null })
  if (error) return { error: friendly(error.message) }
  if (kit?.lead_id && kit.lead_id !== user.id) {
    const total = Number(kit.cash_in ?? 0) + Number(kit.upi_in ?? 0) + Number(kit.card_in ?? 0)
    await sendNotification({ recipientId: kit.lead_id, title: `Merch kit approved: ${await moneyText(total)}`, body: 'Thanks for running the stall.', link: `/merch/kits/${kitId}`, type: 'merch_kit_approved' })
  }
  revalidatePath('/finance', 'layout')
  refresh(kitId, kit?.show_id)
  return { id: txId ?? undefined }
}
