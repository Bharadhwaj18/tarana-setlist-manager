import { describe, expect, it } from 'vitest'
import { buildMerchReport, csvLine, inPeriod, reportCsv } from './merch-report'

const show = { id: 's1', title: 'Blue Frog', show_date: '2026-11-01' }
const items = [{ id: 'tee', name: 'Logo tee' }, { id: 'stk', name: 'Stickers' }]
const variants = [{ id: 'teeM', item_id: 'tee', label: 'M' }, { id: 'teeL', item_id: 'tee', label: 'L' }, { id: 'stk1', item_id: 'stk', label: 'One size' }]

const move = (variant_id: string, qty: number, reason: string, extra: Record<string, unknown> = {}) =>
  ({ variant_id, qty, reason, unit_cost: null, unit_price: null, show_id: null, kit_id: null, date: '2026-11-01', show: null, ...extra })
const sale = (extra: Record<string, unknown>) =>
  ({ id: 'x', show_id: null, kit_id: null, date: '2026-11-01', status: 'pending', cash_amount: 0, upi_amount: 0, card_amount: 0, show: null, ...extra })

const base = {
  items, variants,
  moves: [
    move('teeM', 20, 'restock', { unit_cost: 200, date: '2026-10-01' }),
    move('teeL', 10, 'restock', { unit_cost: 250, date: '2026-10-01' }),
    move('stk1', 100, 'restock', { date: '2026-10-01' }), // no cost recorded
    move('teeM', -4, 'sale', { unit_price: 500, show_id: 's1', show }),
    move('teeL', -2, 'sale', { unit_price: 500, show_id: 's1', show }),
    move('stk1', -10, 'sale', { unit_price: 50, show_id: 's1', show }),
    move('teeM', -1, 'giveaway', { show_id: 's1', show }),
    move('teeL', -1, 'damaged', { date: '2026-11-05' }), // a hand-logged loss away from any show
    move('teeM', -2, 'sale', { unit_price: 450, date: '2026-12-01' }), // outside November
  ],
  sales: [
    sale({ id: 'a', show_id: 's1', show, cash_amount: 2000, status: 'approved' }),
    sale({ id: 'b', show_id: 's1', show, upi_amount: 1300 }),
  ],
  kits: [],
}
const november = { from: '2026-11-01', to: '2026-11-30' }

describe('buildMerchReport', () => {
  const report = buildMerchReport({ ...base, period: november })

  it('sums each show: units, list value, money taken, cost and profit', () => {
    expect(report.byShow).toHaveLength(1)
    const r = report.byShow[0]
    expect(r).toMatchObject({ label: 'Blue Frog', date: '2026-11-01', sold: 16, given: 1, lost: 0, listValue: 3500, taken: 3300, pending: 1300 })
    expect(r.cost).toBe(4 * 200 + 2 * 250) // stickers had no cost
    expect(r.writeOff).toBe(200) // one tee given away
    expect(r.profit).toBe(3300 - 1300 - 200)
    expect(r.costMissing).toBe(true)
  })

  it('sums each item at list price, including losses away from shows', () => {
    const tee = report.byItem.find(r => r.key === 'tee')!
    expect(tee).toMatchObject({ sold: 6, given: 1, lost: 1, listValue: 3000, cost: 1300, writeOff: 450, profit: 3000 - 1300 - 450, costMissing: false })
    expect(report.byItem.find(r => r.key === 'stk')!.costMissing).toBe(true)
  })

  it('totals real money, with every write-off', () => {
    expect(report.totals).toMatchObject({ sold: 16, taken: 3300, given: 1, lost: 1, writeOff: 450, cost: 1300 })
    expect(report.totals.profit).toBe(3300 - 1300 - 450)
  })

  it('leaves out anything outside the period', () => {
    const all = buildMerchReport({ ...base, period: {} })
    expect(all.byShow.find(r => r.key === 'none')).toMatchObject({ sold: 2, listValue: 900 })
  })

  it('counts a closed kit by the money handed in, once', () => {
    const r = buildMerchReport({
      ...base,
      sales: [sale({ id: 'k1', show_id: 's1', show, kit_id: 'kit', upi_amount: 900 }), sale({ id: 'k2', show_id: 's1', show, kit_id: 'kit', cash_amount: 500 })],
      kits: [{ id: 'kit', show_id: 's1', status: 'closed', cash_in: 1000, upi_in: 900, card_in: 0 }],
      period: november,
    })
    expect(r.byShow[0]).toMatchObject({ taken: 1900, pending: 1900 })
  })
})

describe('helpers', () => {
  it('checks a date against a period', () => {
    expect(inPeriod('2026-11-15', november)).toBe(true)
    expect(inPeriod('2026-12-01', november)).toBe(false)
    expect(inPeriod('2020-01-01', {})).toBe(true)
  })
  it('quotes CSV cells that need it', () => {
    expect(csvLine(['a', 'b,c', 'say "hi"', 3, null])).toBe('a,"b,c","say ""hi""",3,')
  })
  it('writes the shows CSV', () => {
    const csv = reportCsv(buildMerchReport({ ...base, period: november }), 'shows').split('\n')
    expect(csv[0].startsWith('Show,Date,Sold')).toBe(true)
    expect(csv[1].startsWith('Blue Frog,2026-11-01,16,1,0,3500,3300,1300')).toBe(true)
  })
})
