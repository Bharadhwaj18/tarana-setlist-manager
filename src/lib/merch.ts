// Merch maths, kept free of the database so it can be tested on its own.
//
// Stock is never stored: it is the sum of every stock move for a variant (+ restock / return, - sale / giveaway /
// damaged, +/- count fix). Cost per unit is the average of what restocks cost, weighted by how many came in.

import type { Database } from '@/types/database'

export type MerchItem = Database['public']['Tables']['merch_items']['Row']
export type MerchVariant = Database['public']['Tables']['merch_variants']['Row']
export type MerchBatch = Database['public']['Tables']['merch_batches']['Row']
export type MerchMove = Database['public']['Tables']['merch_stock_moves']['Row']

export const MOVE_REASONS = ['restock', 'sale', 'giveaway', 'damaged', 'return', 'count_fix'] as const
export type MoveReason = (typeof MOVE_REASONS)[number]

/** Reasons a person can log by hand from the stock screen (restocks and sales have their own forms). */
export const ADJUST_REASONS = ['giveaway', 'damaged', 'return', 'count_fix'] as const
export type AdjustReason = (typeof ADJUST_REASONS)[number]

export const REASON_LABELS: Record<MoveReason, string> = {
  restock: 'Restock',
  sale: 'Sold',
  giveaway: 'Given away',
  damaged: 'Damaged / lost',
  return: 'Returned',
  count_fix: 'Count fix',
}

/** Which way a reason moves stock: 1 = in, -1 = out, 0 = either (a count fix). */
export const REASON_SIGN: Record<MoveReason, 1 | -1 | 0> = {
  restock: 1, return: 1, sale: -1, giveaway: -1, damaged: -1, count_fix: 0,
}

/** The quantity to store for a reason: always positive for stock in, negative for stock out. Count fixes keep their sign. */
export function signedQty(reason: MoveReason, qty: number): number {
  const sign = REASON_SIGN[reason]
  return sign === 0 ? Math.trunc(qty) : sign * Math.abs(Math.trunc(qty))
}

export const isMoveReason = (v: unknown): v is MoveReason => typeof v === 'string' && (MOVE_REASONS as readonly string[]).includes(v)

type MoveLike = Pick<MerchMove, 'variant_id' | 'qty' | 'reason' | 'unit_cost' | 'unit_price'>

export interface VariantStats {
  /** Units on hand now. */
  stock: number
  /** Units in from restocks (not returns or count fixes). */
  restocked: number
  sold: number
  givenAway: number
  damaged: number
  /** Money taken for units sold (unit price x units). */
  revenue: number
  /** Average cost of one unit across restocks that recorded a cost; null when no restock had a cost. */
  avgCost: number | null
}

const emptyStats = (): VariantStats => ({ stock: 0, restocked: 0, sold: 0, givenAway: 0, damaged: 0, revenue: 0, avgCost: null })

/** Per-variant stock and totals from a list of moves. */
export function statsByVariant(moves: MoveLike[]): Map<string, VariantStats> {
  const out = new Map<string, VariantStats>()
  const costUnits = new Map<string, { units: number; cost: number }>()
  for (const m of moves) {
    const s = out.get(m.variant_id) ?? emptyStats()
    s.stock += m.qty
    if (m.reason === 'restock') {
      s.restocked += m.qty
      if (m.unit_cost != null) {
        const c = costUnits.get(m.variant_id) ?? { units: 0, cost: 0 }
        c.units += m.qty
        c.cost += m.qty * Number(m.unit_cost)
        costUnits.set(m.variant_id, c)
      }
    } else if (m.reason === 'sale') {
      s.sold += -m.qty
      s.revenue += -m.qty * Number(m.unit_price ?? 0)
    } else if (m.reason === 'giveaway') s.givenAway += -m.qty
    else if (m.reason === 'damaged') s.damaged += -m.qty
    out.set(m.variant_id, s)
  }
  for (const [id, c] of costUnits) {
    const s = out.get(id)
    if (s && c.units > 0) s.avgCost = round2(c.cost / c.units)
  }
  return out
}

export const statsFor = (stats: Map<string, VariantStats>, variantId: string): VariantStats => stats.get(variantId) ?? emptyStats()

/** Adds several variants' stats together (for an item's total row). Average cost is weighted by restocked units. */
export function sumStats(list: VariantStats[]): VariantStats {
  const total = emptyStats()
  let costUnits = 0
  let cost = 0
  for (const s of list) {
    total.stock += s.stock
    total.restocked += s.restocked
    total.sold += s.sold
    total.givenAway += s.givenAway
    total.damaged += s.damaged
    total.revenue += s.revenue
    if (s.avgCost != null && s.restocked > 0) { costUnits += s.restocked; cost += s.avgCost * s.restocked }
  }
  total.avgCost = costUnits > 0 ? round2(cost / costUnits) : null
  return total
}

/** What a variant sells for: its own price, or the item's. */
export const variantPrice = (item: Pick<MerchItem, 'price'>, variant: Pick<MerchVariant, 'price'>): number =>
  Number(variant.price ?? item.price ?? 0)

/** At or below the variant's warning level. Variants with no warning level are never low. */
export const isLowStock = (variant: Pick<MerchVariant, 'low_stock_at'>, stock: number): boolean =>
  variant.low_stock_at != null && stock <= variant.low_stock_at

/**
 * Spreads a batch's total cost evenly over every unit in it, so each restock line records the same unit cost.
 * Returns null when there are no units or no cost was given.
 */
export function unitCostOf(totalCost: number, lines: { qty: number }[]): number | null {
  const units = lines.reduce((n, l) => n + Math.max(0, Math.trunc(l.qty)), 0)
  if (units <= 0 || !(totalCost > 0)) return null
  return round2(totalCost / units)
}

/** The count fix needed to make stock match what was physically counted. */
export const countFixFor = (current: number, counted: number): number => Math.trunc(counted) - current

/** Parses "S, M, L, XL" (or one per line) into clean, de-duplicated variant labels. Empty input means one "One size". */
export function parseVariantLabels(input: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of input.split(/[,\n]/)) {
    const label = raw.trim().replace(/\s+/g, ' ').slice(0, 40)
    if (!label || seen.has(label.toLowerCase())) continue
    seen.add(label.toLowerCase())
    out.push(label)
  }
  return out.length ? out : ['One size']
}

const round2 = (n: number) => Math.round(n * 100) / 100

// ---- Sales ---------------------------------------------------------------------------------------------------------

export type MerchSale = Database['public']['Tables']['merch_sales']['Row']
export type SaleMode = 'count' | 'stall' | 'manual'
export type PaymentMethod = 'cash' | 'upi' | 'card'

/** Money taken on a sale, all payment methods together. */
export const saleTakings = (s: Pick<MerchSale, 'cash_amount' | 'upi_amount' | 'card_amount'>): number =>
  round2(Number(s.cash_amount) + Number(s.upi_amount) + Number(s.card_amount))

/** What the units should have brought in at their prices. */
export const expectedTotal = (lines: { qty: number; price: number }[]): number =>
  round2(lines.reduce((sum, l) => sum + Math.max(0, Math.trunc(l.qty)) * l.price, 0))

/**
 * End-of-night count: units sold is what went out minus what came back.
 * Returns an error message when the numbers can't be right (more back than went out).
 */
export function soldFromCount(tookOut: number, broughtBack: number): { sold: number } | { error: string } {
  const out = Math.trunc(tookOut || 0)
  const back = Math.trunc(broughtBack || 0)
  if (out < 0 || back < 0) return { error: 'Counts can’t be negative.' }
  if (back > out) return { error: 'More came back than went out.' }
  return { sold: out - back }
}

/** Sales grouped by show (null = not at a show), newest show first, for approving one show at a time. */
export function groupSalesByShow<T extends Pick<MerchSale, 'show_id' | 'date'>>(sales: T[]): { showId: string | null; sales: T[] }[] {
  const groups = new Map<string, T[]>()
  for (const s of sales) {
    const key = s.show_id ?? ''
    groups.set(key, [...(groups.get(key) ?? []), s])
  }
  const latest = (list: T[]) => list.reduce((d, s) => (s.date > d ? s.date : d), '')
  return [...groups.entries()]
    .map(([key, list]) => ({ showId: key || null, sales: list }))
    .sort((a, b) => latest(b.sales).localeCompare(latest(a.sales)))
}

// ---- Show kits -----------------------------------------------------------------------------------------------------

export type MerchKit = Database['public']['Tables']['merch_kits']['Row']
export type MerchKitLine = Database['public']['Tables']['merch_kit_lines']['Row']
export type KitStatus = 'open' | 'closed' | 'approved'

type KitMoveLike = Pick<MerchMove, 'kit_id' | 'variant_id' | 'qty' | 'reason'>

/** Units sold from a kit so far, per variant. */
export function kitSoldByVariant(kitId: string, moves: KitMoveLike[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const m of moves) if (m.kit_id === kitId && m.reason === 'sale') out.set(m.variant_id, (out.get(m.variant_id) ?? 0) - m.qty)
  return out
}

/** Still in the box: went out, minus sold so far. */
export const kitLeft = (taken: number, sold: number): number => Math.max(0, taken - sold)

/**
 * At close: units that went out and aren't accounted for by taps, the count back, giveaways or losses are sold
 * (recorded in one close-out sale). Negative means more was counted than went out.
 */
export const closeoutSold = (taken: number, tapped: number, returned: number, given: number, lost: number): number =>
  taken - tapped - returned - given - lost

/**
 * Units of each variant that are out of the house in kits not yet approved: an open kit holds what went minus what
 * sold; a closed kit still holds its giveaways and losses until it's approved. Approved kits hold nothing.
 */
export function outInKits(kits: Pick<MerchKit, 'id' | 'status'>[], lines: Pick<MerchKitLine, 'kit_id' | 'variant_id' | 'taken' | 'returned'>[], moves: KitMoveLike[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const kit of kits) {
    if (kit.status === 'approved') continue
    const sold = kitSoldByVariant(kit.id, moves)
    for (const l of lines) {
      if (l.kit_id !== kit.id) continue
      const n = l.taken - (sold.get(l.variant_id) ?? 0) - (l.returned ?? 0)
      if (n > 0) out.set(l.variant_id, (out.get(l.variant_id) ?? 0) + n)
    }
  }
  return out
}

export const KIT_STATUS_LABELS: Record<KitStatus, string> = { open: 'At the show', closed: 'Waiting for approval', approved: 'Done' }

/** A size just crossed its low-stock level: above it before this change, at or below it now. */
export function crossedLowStock(stockNow: number, change: number, lowAt: number | null): boolean {
  if (lowAt == null || change >= 0) return false
  return stockNow - change > lowAt && stockNow <= lowAt
}
