// Merch reports: what sold, what it brought in, what it cost and what was left over, per show and per item,
// for a period. Kept free of the database so it can be tested on its own.
//
// - Money taken is what was actually collected. For a closed or approved kit that's the money handed in at the
//   end of the night; otherwise it's the sales recorded.
// - List value is units sold at their prices; the gap to money taken is discounts (or a shortfall).
// - Cost of goods uses each size's average cost across restocks. Sizes with no recorded cost count as zero and
//   are flagged, so the profit isn't silently overstated.
// - Giveaways and missing stock cost money too, at the same average cost.

import { saleTakings, statsByVariant, statsFor, type MerchItem, type MerchKit, type MerchMove, type MerchSale, type MerchVariant } from '@/lib/merch'

export interface Period { from?: string | null; to?: string | null }

export const inPeriod = (date: string, p: Period) => (!p.from || date >= p.from) && (!p.to || date <= p.to)

export interface ReportRow {
  key: string
  label: string
  /** Show date for show rows. */
  date?: string | null
  sold: number
  given: number
  lost: number
  /** Units sold at their prices. */
  listValue: number
  /** Money actually collected. Item rows use list value (money isn't split by item). */
  taken: number
  cost: number
  /** Giveaways and losses at cost. */
  writeOff: number
  profit: number
  /** Some units had no restock cost, so cost (and profit) is incomplete. */
  costMissing: boolean
  /** Show rows: money not yet approved into Finance. */
  pending?: number
}

export interface MerchReport {
  byShow: ReportRow[]
  byItem: ReportRow[]
  totals: ReportRow
}

type ShowRef = { id: string; title: string; show_date: string | null } | null
type MoveIn = Pick<MerchMove, 'variant_id' | 'qty' | 'reason' | 'unit_cost' | 'unit_price' | 'show_id' | 'kit_id' | 'date'> & { show?: ShowRef }
type SaleIn = Pick<MerchSale, 'id' | 'show_id' | 'kit_id' | 'date' | 'status' | 'cash_amount' | 'upi_amount' | 'card_amount'> & { show?: ShowRef }
type KitIn = Pick<MerchKit, 'id' | 'show_id' | 'status' | 'cash_in' | 'upi_in' | 'card_in'>

const blank = (key: string, label: string, date?: string | null): ReportRow =>
  ({ key, label, date, sold: 0, given: 0, lost: 0, listValue: 0, taken: 0, cost: 0, writeOff: 0, profit: 0, costMissing: false, pending: 0 })

const round = (n: number) => Math.round(n * 100) / 100

export function buildMerchReport(input: {
  items: Pick<MerchItem, 'id' | 'name'>[]
  variants: Pick<MerchVariant, 'id' | 'item_id' | 'label'>[]
  /** Every stock move (all time): average costs come from all restocks, the period only filters what's counted. */
  moves: MoveIn[]
  sales: SaleIn[]
  kits: KitIn[]
  period: Period
}): MerchReport {
  const { items, variants, moves, sales, kits, period } = input
  const stats = statsByVariant(moves)
  const itemOf = new Map(variants.map(v => [v.id, v.item_id]))
  const itemName = new Map(items.map(i => [i.id, i.name]))

  const shows = new Map<string, ReportRow>()
  const byItem = new Map<string, ReportRow>()
  const showRow = (showId: string | null, show?: ShowRef) => {
    const key = showId ?? 'none'
    if (!shows.has(key)) shows.set(key, blank(key, showId ? show?.title ?? 'Deleted show' : 'Not at a show', show?.show_date ?? null))
    const row = shows.get(key)!
    if (show && row.label === 'Deleted show') { row.label = show.title; row.date = show.show_date }
    return row
  }
  const itemRow = (variantId: string) => {
    const id = itemOf.get(variantId) ?? 'removed'
    if (!byItem.has(id)) byItem.set(id, blank(id, itemName.get(id) ?? 'Removed item'))
    return byItem.get(id)!
  }

  // Units, list value, cost and write-offs from the stock log.
  for (const m of moves) {
    if (!inPeriod(m.date, period)) continue
    if (m.reason !== 'sale' && m.reason !== 'giveaway' && m.reason !== 'damaged') continue
    const units = -m.qty
    const avg = statsFor(stats, m.variant_id).avgCost
    const unitCost = avg ?? 0
    const rows = [itemRow(m.variant_id)]
    // Damage logged by hand away from a show is a stock problem, not a show's.
    if (m.reason === 'sale' || m.show_id || m.kit_id) rows.push(showRow(m.show_id, m.show))
    for (const r of rows) {
      if (avg == null && units > 0) r.costMissing = true
      if (m.reason === 'sale') {
        r.sold += units
        r.listValue += units * Number(m.unit_price ?? 0)
        r.cost += units * unitCost
      } else {
        if (m.reason === 'giveaway') r.given += units
        else r.lost += units
        r.writeOff += units * unitCost
      }
    }
  }

  // Money collected per show: a closed kit counts what was handed in; everything else counts its sales.
  const kitById = new Map(kits.map(k => [k.id, k]))
  const countedKits = new Set<string>()
  for (const s of sales) {
    if (!inPeriod(s.date, period)) continue
    const row = showRow(s.show_id, s.show)
    const kit = s.kit_id ? kitById.get(s.kit_id) : null
    if (kit && kit.status !== 'open') {
      if (countedKits.has(kit.id)) continue
      countedKits.add(kit.id)
      const handed = Number(kit.cash_in ?? 0) + Number(kit.upi_in ?? 0) + Number(kit.card_in ?? 0)
      row.taken += handed
      if (kit.status !== 'approved') row.pending! += handed
    } else {
      row.taken += saleTakings(s)
      if (s.status !== 'approved') row.pending! += saleTakings(s)
    }
  }

  const finish = (r: ReportRow, takenIsList: boolean): ReportRow => {
    const taken = takenIsList ? r.listValue : r.taken
    return {
      ...r,
      listValue: round(r.listValue), taken: round(taken), cost: round(r.cost), writeOff: round(r.writeOff),
      profit: round(taken - r.cost - r.writeOff), pending: round(r.pending ?? 0),
    }
  }

  const byShow = [...shows.values()].map(r => finish(r, false))
    .filter(r => r.sold || r.given || r.lost || r.taken)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.label.localeCompare(b.label))
  const itemRows = [...byItem.values()].map(r => finish(r, true))
    .filter(r => r.sold || r.given || r.lost)
    .sort((a, b) => b.listValue - a.listValue || a.label.localeCompare(b.label))

  // Totals add up the show rows (real money), plus write-offs logged away from shows.
  const totals = blank('total', 'Total')
  for (const r of byShow) {
    for (const k of ['sold', 'given', 'lost', 'listValue', 'taken', 'cost', 'writeOff', 'pending'] as const) totals[k] = (totals[k] ?? 0) + (r[k] ?? 0)
    totals.costMissing ||= r.costMissing
  }
  const offShow = itemRows.reduce((acc, r) => ({ given: acc.given + r.given, lost: acc.lost + r.lost, writeOff: acc.writeOff + r.writeOff }), { given: 0, lost: 0, writeOff: 0 })
  totals.given = offShow.given
  totals.lost = offShow.lost
  totals.writeOff = offShow.writeOff
  totals.costMissing ||= itemRows.some(r => r.costMissing)

  return { byShow, byItem: itemRows, totals: finish(totals, false) }
}

/** One CSV line, quoting anything that needs it. */
export function csvLine(cells: (string | number | null | undefined)[]): string {
  return cells.map(c => {
    const s = c == null ? '' : String(c)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }).join(',')
}

export function reportCsv(report: MerchReport, kind: 'shows' | 'items'): string {
  if (kind === 'shows') {
    return [
      csvLine(['Show', 'Date', 'Sold', 'Given away', 'Missing', 'List value', 'Money taken', 'Waiting for approval', 'Cost of goods', 'Giveaways and losses at cost', 'Profit', 'Cost incomplete']),
      ...report.byShow.map(r => csvLine([r.label, r.date ?? '', r.sold, r.given, r.lost, r.listValue, r.taken, r.pending ?? 0, r.cost, r.writeOff, r.profit, r.costMissing ? 'yes' : ''])),
    ].join('\n')
  }
  return [
    csvLine(['Item', 'Sold', 'Given away', 'Missing', 'Sales at list price', 'Cost of goods', 'Giveaways and losses at cost', 'Profit', 'Cost incomplete']),
    ...report.byItem.map(r => csvLine([r.label, r.sold, r.given, r.lost, r.listValue, r.cost, r.writeOff, r.profit, r.costMissing ? 'yes' : ''])),
  ].join('\n')
}
