'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceContext, isMerchApprover, requireWorkspaceId } from '@/lib/workspace'
import { getCachedFinanceSettings } from '@/lib/data'
import { formatMoney } from '@/lib/finance/settings'
import { sendNotification } from '@/actions/notifications'
import { notifyLowStock } from '@/lib/merch-alerts'
import { ADJUST_REASONS, parseVariantLabels, saleTakings, signedQty, unitCostOf, variantPrice, type AdjustReason, type SaleMode } from '@/lib/merch'

type Result = { error?: string; id?: string }

const clean = (s: string | null | undefined, max: number) => {
  const t = (s ?? '').trim().replace(/\s+/g, ' ').slice(0, max)
  return t || null
}
const money = (n: unknown): number | null => {
  if (n === null || n === undefined || n === '') return null
  const v = Number(n)
  return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : NaN
}
const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
const friendly = (message: string) =>
  /merch_items_name_idx/.test(message) ? 'You already have an item with that name.'
    : /merch_variants_label_idx/.test(message) ? 'That item already has a variant with that name.'
      : /row-level security|permission denied/i.test(message) ? 'You don’t have permission to change merch in this workspace.'
        : message

function done() {
  revalidatePath('/merch')
}

async function signedIn() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

// ---- Items and variants ------------------------------------------------------------------------------------------

export interface MerchItemInput {
  name: string
  kind?: string | null
  description?: string | null
  price: number
}

/** A new item with its variants. `variants` is "S, M, L" text; empty makes a single "One size" variant. */
export async function createMerchItem(input: MerchItemInput & { variants: string }): Promise<Result> {
  const { supabase, user } = await signedIn()
  if (!user) return { error: 'Not signed in' }
  const name = clean(input.name, 80)
  if (!name) return { error: 'Give the item a name.' }
  const price = money(input.price) ?? 0
  if (Number.isNaN(price)) return { error: 'Enter a valid price.' }
  const workspace_id = await requireWorkspaceId()

  const { count } = await supabase.from('merch_items').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace_id)
  const { data: item, error } = await supabase.from('merch_items').insert({
    workspace_id, name, price,
    kind: clean(input.kind, 40),
    description: clean(input.description, 2000),
    position: count ?? 0,
  }).select('id').single()
  if (error) return { error: friendly(error.message) }

  const labels = parseVariantLabels(input.variants)
  const { error: vError } = await supabase.from('merch_variants').insert(labels.map((label, i) => ({ workspace_id, item_id: item.id, label, position: i })))
  if (vError) {
    await supabase.from('merch_items').delete().eq('id', item.id)
    return { error: friendly(vError.message) }
  }
  done()
  return { id: item.id }
}

export async function updateMerchItem(id: string, input: MerchItemInput): Promise<Result> {
  const { supabase, user } = await signedIn()
  if (!user) return { error: 'Not signed in' }
  const name = clean(input.name, 80)
  if (!name) return { error: 'Give the item a name.' }
  const price = money(input.price) ?? 0
  if (Number.isNaN(price)) return { error: 'Enter a valid price.' }
  const { error } = await supabase.from('merch_items').update({
    name, price, kind: clean(input.kind, 40), description: clean(input.description, 2000),
  }).eq('id', id)
  if (error) return { error: friendly(error.message) }
  done()
  return {}
}

/** Archiving hides an item from stock and selling but keeps its history. */
export async function setMerchItemArchived(id: string, archived: boolean): Promise<Result> {
  const { supabase, user } = await signedIn()
  if (!user) return { error: 'Not signed in' }
  const { error } = await supabase.from('merch_items').update({ archived_at: archived ? new Date().toISOString() : null }).eq('id', id)
  if (error) return { error: friendly(error.message) }
  done()
  return {}
}

/** Deleting is only allowed while an item has no stock history; otherwise archive it. */
export async function deleteMerchItem(id: string): Promise<Result> {
  const { supabase, user } = await signedIn()
  if (!user) return { error: 'Not signed in' }
  const { data: variants } = await supabase.from('merch_variants').select('id').eq('item_id', id)
  const ids = (variants ?? []).map(v => v.id)
  if (ids.length) {
    const { count } = await supabase.from('merch_stock_moves').select('id', { count: 'exact', head: true }).in('variant_id', ids)
    if ((count ?? 0) > 0) return { error: 'This item has stock history. Archive it instead.' }
  }
  const { error } = await supabase.from('merch_items').delete().eq('id', id)
  if (error) return { error: friendly(error.message) }
  done()
  return {}
}

export interface MerchVariantInput {
  label: string
  price?: number | null
  lowStockAt?: number | null
}

const variantFields = (input: MerchVariantInput) => {
  const label = clean(input.label, 40)
  const price = money(input.price)
  const low = input.lowStockAt === null || input.lowStockAt === undefined || (input.lowStockAt as unknown) === '' ? null : Math.trunc(Number(input.lowStockAt))
  if (!label) return { error: 'Give the variant a name (like M or Black / M).' } as const
  if (Number.isNaN(price)) return { error: 'Enter a valid price.' } as const
  if (low !== null && (!Number.isFinite(low) || low < 0)) return { error: 'The low-stock level must be 0 or more.' } as const
  return { fields: { label, price, low_stock_at: low } } as const
}

export async function addMerchVariant(itemId: string, input: MerchVariantInput): Promise<Result> {
  const { supabase, user } = await signedIn()
  if (!user) return { error: 'Not signed in' }
  const v = variantFields(input)
  if ('error' in v) return { error: v.error }
  const workspace_id = await requireWorkspaceId()
  const { count } = await supabase.from('merch_variants').select('id', { count: 'exact', head: true }).eq('item_id', itemId)
  const { data, error } = await supabase.from('merch_variants').insert({ workspace_id, item_id: itemId, position: count ?? 0, ...v.fields }).select('id').single()
  if (error) return { error: friendly(error.message) }
  done()
  return { id: data.id }
}

export async function updateMerchVariant(id: string, input: MerchVariantInput): Promise<Result> {
  const { supabase, user } = await signedIn()
  if (!user) return { error: 'Not signed in' }
  const v = variantFields(input)
  if ('error' in v) return { error: v.error }
  const { error } = await supabase.from('merch_variants').update(v.fields).eq('id', id)
  if (error) return { error: friendly(error.message) }
  done()
  return {}
}

export async function setMerchVariantArchived(id: string, archived: boolean): Promise<Result> {
  const { supabase, user } = await signedIn()
  if (!user) return { error: 'Not signed in' }
  const { error } = await supabase.from('merch_variants').update({ archived_at: archived ? new Date().toISOString() : null }).eq('id', id)
  if (error) return { error: friendly(error.message) }
  done()
  return {}
}

// ---- Stock -------------------------------------------------------------------------------------------------------

export interface RestockInput {
  date: string
  supplier?: string | null
  totalCost?: number | null
  notes?: string | null
  lines: { variantId: string; qty: number }[]
}

/** A production run or restock: one batch, one stock-in move per variant, each carrying the same cost per unit. */
export async function logMerchRestock(input: RestockInput): Promise<Result> {
  const { supabase, user } = await signedIn()
  if (!user) return { error: 'Not signed in' }
  if (!isDate(input.date)) return { error: 'Pick a date.' }
  const lines = (input.lines ?? []).map(l => ({ variantId: l.variantId, qty: Math.trunc(Number(l.qty)) })).filter(l => l.variantId && l.qty > 0)
  if (!lines.length) return { error: 'Enter how many came in for at least one variant.' }
  const totalCost = money(input.totalCost) ?? 0
  if (Number.isNaN(totalCost)) return { error: 'Enter a valid total cost.' }
  const workspace_id = await requireWorkspaceId()

  const { data: batch, error } = await supabase.from('merch_batches').insert({
    workspace_id, date: input.date, total_cost: totalCost,
    supplier: clean(input.supplier, 120), notes: clean(input.notes, 2000),
  }).select('id').single()
  if (error) return { error: friendly(error.message) }

  const unit_cost = unitCostOf(totalCost, lines)
  const { error: mError } = await supabase.from('merch_stock_moves').insert(lines.map(l => ({
    workspace_id, variant_id: l.variantId, qty: l.qty, reason: 'restock', unit_cost, batch_id: batch.id, date: input.date,
  })))
  if (mError) {
    await supabase.from('merch_batches').delete().eq('id', batch.id)
    return { error: friendly(mError.message) }
  }
  done()
  return { id: batch.id }
}

/** Deletes a restock and every stock move it added. */
export async function deleteMerchBatch(id: string): Promise<Result> {
  const { supabase, user } = await signedIn()
  if (!user) return { error: 'Not signed in' }
  const { error } = await supabase.from('merch_batches').delete().eq('id', id)
  if (error) return { error: friendly(error.message) }
  done()
  return {}
}

export interface AdjustInput {
  variantId: string
  reason: AdjustReason
  /** Units for giveaway / damaged / return (always positive), or the signed change for a count fix. */
  qty: number
  date: string
  showId?: string | null
  note?: string | null
}

/** Giveaways, damage, returns and count fixes. */
export async function adjustMerchStock(input: AdjustInput): Promise<Result> {
  const { supabase, user } = await signedIn()
  if (!user) return { error: 'Not signed in' }
  if (!(ADJUST_REASONS as readonly string[]).includes(input.reason)) return { error: 'Pick what happened.' }
  if (!isDate(input.date)) return { error: 'Pick a date.' }
  const qty = signedQty(input.reason, Number(input.qty))
  if (!Number.isFinite(qty) || qty === 0) return { error: input.reason === 'count_fix' ? 'The count already matches.' : 'Enter how many.' }
  const workspace_id = await requireWorkspaceId()
  const { data, error } = await supabase.from('merch_stock_moves').insert({
    workspace_id,
    variant_id: input.variantId, qty, reason: input.reason, date: input.date,
    show_id: input.showId || null, note: clean(input.note, 500),
  }).select('id').single()
  if (error) return { error: friendly(error.message) }
  await notifyLowStock(workspace_id, user.id, new Map([[input.variantId, qty]]))
  done()
  return { id: data.id }
}

/** Undoes one hand-logged adjustment. Restocks and sales are removed through their batch or sale instead. */
export async function deleteMerchMove(id: string): Promise<Result> {
  const { supabase, user } = await signedIn()
  if (!user) return { error: 'Not signed in' }
  const { data: move } = await supabase.from('merch_stock_moves').select('batch_id, sale_id').eq('id', id).maybeSingle()
  if (!move) return { error: 'That entry is already gone.' }
  if (move.batch_id) return { error: 'This came from a restock. Delete the restock instead.' }
  if (move.sale_id) return { error: 'This came from a sale. Delete the sale instead.' }
  const { error } = await supabase.from('merch_stock_moves').delete().eq('id', id)
  if (error) return { error: friendly(error.message) }
  done()
  return {}
}

// ---- Sales -------------------------------------------------------------------------------------------------------
//
// A sale takes its stock out straight away and waits as "pending". Nothing reaches Finance until a merch approver
// (owner, admin or Merch role) approves the show's sales, which writes one income entry (see approve_merch_sales).

export interface SaleInput {
  showId?: string | null
  date: string
  mode: SaleMode
  lines: { variantId: string; qty: number }[]
  cash?: number | null
  upi?: number | null
  card?: number | null
  /** Who ran the stall or is holding the money. Defaults to whoever records it. */
  heldBy?: string | null
  notes?: string | null
}

async function moneyText(n: number) {
  return formatMoney(n, (await getCachedFinanceSettings()).currency)
}

/** Everyone in the workspace who can approve merch takings, except the person doing this. */
async function merchApproverIds(supabase: Awaited<ReturnType<typeof createClient>>, workspaceId: string, except: string) {
  const { data } = await supabase.from('workspace_members').select('user_id, role, permissions').eq('workspace_id', workspaceId)
  return (data ?? [])
    .filter(m => m.user_id !== except && (m.role === 'owner' || m.role === 'admin' || (m.permissions as Record<string, unknown> | null)?.merch_manager === true))
    .map(m => m.user_id)
}

export async function recordMerchSale(input: SaleInput): Promise<Result> {
  const { supabase, user } = await signedIn()
  if (!user) return { error: 'Not signed in' }
  if (!isDate(input.date)) return { error: 'Pick a date.' }
  if (!['count', 'stall', 'manual'].includes(input.mode)) return { error: 'Unknown kind of sale.' }

  // One line per variant, positive whole units.
  const qtyByVariant = new Map<string, number>()
  for (const l of input.lines ?? []) {
    const q = Math.trunc(Number(l.qty))
    if (l.variantId && q > 0) qtyByVariant.set(l.variantId, (qtyByVariant.get(l.variantId) ?? 0) + q)
  }
  const amounts = [money(input.cash), money(input.upi), money(input.card)].map(a => a ?? 0)
  if (amounts.some(Number.isNaN)) return { error: 'Enter valid amounts.' }
  const [cash_amount, upi_amount, card_amount] = amounts
  if (!qtyByVariant.size && cash_amount + upi_amount + card_amount === 0) return { error: 'Add what was sold, or the money taken.' }

  const workspace_id = await requireWorkspaceId()
  const ids = [...qtyByVariant.keys()]
  const { data: variants } = ids.length
    ? await supabase.from('merch_variants').select('id, price, item:merch_items(price)').in('id', ids).eq('workspace_id', workspace_id)
    : { data: [] }
  if ((variants ?? []).length !== ids.length) return { error: 'Some of those items are no longer there. Reload and try again.' }

  if (input.showId) {
    const { data: show } = await supabase.from('shows').select('id').eq('id', input.showId).eq('workspace_id', workspace_id).maybeSingle()
    if (!show) return { error: 'That show is no longer there.' }
  }

  let held_by = input.heldBy || user.id
  if (held_by !== user.id) {
    const { data: member } = await supabase.from('workspace_members').select('user_id').eq('workspace_id', workspace_id).eq('user_id', held_by).maybeSingle()
    if (!member) held_by = user.id
  }

  const { data: sale, error } = await supabase.from('merch_sales').insert({
    workspace_id, show_id: input.showId || null, date: input.date, mode: input.mode,
    cash_amount, upi_amount, card_amount, held_by, notes: clean(input.notes, 2000),
  }).select('id').single()
  if (error) return { error: friendly(error.message) }

  if (ids.length) {
    const { error: mError } = await supabase.from('merch_stock_moves').insert((variants ?? []).map(v => {
      const item = Array.isArray(v.item) ? v.item[0] : v.item
      return {
        workspace_id, variant_id: v.id, qty: -(qtyByVariant.get(v.id) ?? 0), reason: 'sale',
        unit_price: variantPrice({ price: item?.price ?? 0 }, v), show_id: input.showId || null, sale_id: sale.id, date: input.date,
      }
    }))
    if (mError) {
      await supabase.from('merch_sales').delete().eq('id', sale.id)
      return { error: friendly(mError.message) }
    }
  }

  await notifyLowStock(workspace_id, user.id, new Map([...qtyByVariant].map(([id, q]) => [id, -q])))

  // Tell the approvers there's money to look at.
  const total = cash_amount + upi_amount + card_amount
  if (total > 0) {
    const [{ data: actor }, approvers] = await Promise.all([
      supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle(),
      merchApproverIds(supabase, workspace_id, user.id),
    ])
    const units = [...qtyByVariant.values()].reduce((a, b) => a + b, 0)
    const title = `${actor?.display_name ?? 'Someone'} recorded ${await moneyText(total)} of merch sales`
    for (const recipientId of approvers) {
      await sendNotification({ recipientId, title, body: `${units} unit${units === 1 ? '' : 's'}, waiting for your approval`, link: '/merch', type: 'merch_sale_pending' })
    }
  }

  done()
  if (input.showId) revalidatePath(`/shows/${input.showId}`)
  return { id: sale.id }
}

/** Deletes a pending sale (it was a mistake), putting its stock back. */
export async function deleteMerchSale(id: string): Promise<Result> {
  const { supabase, user } = await signedIn()
  if (!user) return { error: 'Not signed in' }
  const { data: sale } = await supabase.from('merch_sales').select('status, show_id').eq('id', id).maybeSingle()
  if (!sale) return { error: 'That sale is already gone.' }
  if (sale.status !== 'pending') return { error: 'This sale is approved and in Finance, so it can’t be deleted here.' }
  const { error } = await supabase.from('merch_sales').delete().eq('id', id)
  if (error) return { error: friendly(error.message) }
  done()
  if (sale.show_id) revalidatePath(`/shows/${sale.show_id}`)
  return {}
}

/** An approver turns a pending sale down: it's removed, its stock goes back, and whoever recorded it is told why. */
export async function rejectMerchSale(id: string, reason: string): Promise<Result> {
  const { supabase, user } = await signedIn()
  if (!user) return { error: 'Not signed in' }
  const ctx = await getWorkspaceContext()
  if (!ctx || !isMerchApprover(ctx.current)) return { error: 'Only an admin or someone with the Merch role can turn sales down.' }
  const { data: sale } = await supabase.from('merch_sales').select('status, show_id, created_by, cash_amount, upi_amount, card_amount').eq('id', id).maybeSingle()
  if (!sale) return { error: 'That sale is already gone.' }
  if (sale.status !== 'pending') return { error: 'This sale is already approved.' }
  const { error } = await supabase.from('merch_sales').delete().eq('id', id)
  if (error) return { error: friendly(error.message) }
  if (sale.created_by !== user.id) {
    await sendNotification({
      recipientId: sale.created_by,
      title: `Merch sale not approved: ${await moneyText(saleTakings(sale))}`,
      body: reason.trim() || 'It was removed and the stock put back.',
      link: '/merch',
      type: 'merch_sale_decided',
    })
  }
  done()
  if (sale.show_id) revalidatePath(`/shows/${sale.show_id}`)
  return {}
}

/**
 * Approves pending sales from one show (or all from no show) and writes one Finance income entry for their total.
 * The money is held by `memberId` or `accountId`; with neither, by whoever held it on the first sale.
 */
export async function approveMerchSales(saleIds: string[], to: { memberId?: string | null; accountId?: string | null } = {}): Promise<Result> {
  const { supabase, user } = await signedIn()
  if (!user) return { error: 'Not signed in' }
  if (!saleIds?.length) return { error: 'Pick at least one sale.' }
  const ctx = await getWorkspaceContext()
  if (!ctx || !isMerchApprover(ctx.current)) return { error: 'Only an admin or someone with the Merch role can approve merch takings.' }
  if (to.accountId && !(await getCachedFinanceSettings()).features.accounts) return { error: 'Band accounts are switched off for this workspace.' }

  const { data: sales } = await supabase.from('merch_sales').select('created_by, show_id, cash_amount, upi_amount, card_amount').in('id', saleIds)
  const { data: txId, error } = await supabase.rpc('approve_merch_sales', { p_ids: saleIds, p_member: to.memberId || null, p_account: to.accountId || null })
  if (error) return { error: friendly(error.message) }

  const total = (sales ?? []).reduce((sum, s) => sum + saleTakings(s), 0)
  for (const recipientId of new Set((sales ?? []).map(s => s.created_by).filter(id => id !== user.id))) {
    await sendNotification({ recipientId, title: `Merch takings approved: ${await moneyText(total)}`, body: 'Added to Finance.', link: '/finance', type: 'merch_sale_decided' })
  }

  done()
  revalidatePath('/finance', 'layout')
  const showId = sales?.[0]?.show_id
  if (showId) revalidatePath(`/shows/${showId}`)
  return { id: txId ?? undefined }
}
