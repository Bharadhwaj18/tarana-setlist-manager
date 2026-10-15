import { PAYOUT_KEYS } from './settings'

interface Entry { amount: number; category: string | null }

export interface Totals {
  moneyIn: number
  moneyOut: number
  /** Money in minus money out, before anything paid to members. */
  net: number
  /** Money moved to members by splits; not income or spending. */
  payouts: number
  count: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function isPayout(e: Pick<Entry, 'category'>) {
  return !!e.category && PAYOUT_KEYS.has(e.category)
}

export function summarise(entries: Entry[]): Totals {
  let moneyIn = 0, moneyOut = 0, payouts = 0
  for (const e of entries) {
    if (isPayout(e)) payouts += -e.amount
    else if (e.amount >= 0) moneyIn += e.amount
    else moneyOut += -e.amount
  }
  return { moneyIn: round2(moneyIn), moneyOut: round2(moneyOut), net: round2(moneyIn - moneyOut), payouts: round2(payouts), count: entries.length }
}

export interface Group { key: string; label: string; totals: Totals }

/**
 * Totals per group. An entry can fall in several groups (an entry with two tags counts under both)
 * or none (it's listed under `emptyLabel`). Sorted by the money involved, largest first.
 */
export function groupTotals<T extends Entry>(entries: T[], keysOf: (e: T) => string[], labelOf: (key: string) => string, emptyLabel: string): Group[] {
  const buckets = new Map<string, T[]>()
  for (const e of entries) {
    const keys = keysOf(e)
    for (const k of keys.length > 0 ? keys : ['']) {
      const list = buckets.get(k) ?? []
      list.push(e)
      buckets.set(k, list)
    }
  }
  return [...buckets.entries()]
    .map(([key, list]) => ({ key, label: key ? labelOf(key) : emptyLabel, totals: summarise(list) }))
    .sort((a, b) => (b.totals.moneyIn + b.totals.moneyOut) - (a.totals.moneyIn + a.totals.moneyOut))
}
