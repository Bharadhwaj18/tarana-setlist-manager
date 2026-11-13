'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspaceId } from '@/lib/workspace'
import { ADJUST_REASONS, parseVariantLabels, signedQty, unitCostOf, type AdjustReason } from '@/lib/merch'

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
  const { data, error } = await supabase.from('merch_stock_moves').insert({
    workspace_id: await requireWorkspaceId(),
    variant_id: input.variantId, qty, reason: input.reason, date: input.date,
    show_id: input.showId || null, note: clean(input.note, 500),
  }).select('id').single()
  if (error) return { error: friendly(error.message) }
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
