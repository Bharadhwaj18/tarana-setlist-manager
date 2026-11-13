import { describe, expect, it } from 'vitest'
import { countFixFor, expectedTotal, groupSalesByShow, isLowStock, parseVariantLabels, saleTakings, signedQty, soldFromCount, statsByVariant, statsFor, sumStats, unitCostOf, variantPrice } from './merch'

const move = (variant_id: string, qty: number, reason: string, unit_cost: number | null = null, unit_price: number | null = null) =>
  ({ variant_id, qty, reason, unit_cost, unit_price })

describe('statsByVariant', () => {
  it('sums stock from every move and splits out each reason', () => {
    const stats = statsByVariant([
      move('m', 20, 'restock', 200),
      move('m', -5, 'sale', null, 500),
      move('m', -1, 'giveaway'),
      move('m', -1, 'damaged'),
      move('m', 1, 'return'),
      move('m', -2, 'count_fix'),
    ])
    expect(statsFor(stats, 'm')).toEqual({ stock: 12, restocked: 20, sold: 5, givenAway: 1, damaged: 1, revenue: 2500, avgCost: 200 })
  })

  it('weights the average cost by how many units each restock brought in', () => {
    const s = statsFor(statsByVariant([move('m', 10, 'restock', 100), move('m', 30, 'restock', 200)]), 'm')
    expect(s.avgCost).toBe(175)
  })

  it('ignores restocks with no cost when averaging', () => {
    const s = statsFor(statsByVariant([move('m', 10, 'restock', 100), move('m', 5, 'restock', null)]), 'm')
    expect(s.avgCost).toBe(100)
    expect(s.stock).toBe(15)
  })

  it('gives empty stats for a variant with no moves', () => {
    expect(statsFor(statsByVariant([]), 'x')).toEqual({ stock: 0, restocked: 0, sold: 0, givenAway: 0, damaged: 0, revenue: 0, avgCost: null })
  })
})

describe('sumStats', () => {
  it('adds variants together and weights cost by restocked units', () => {
    const stats = statsByVariant([move('s', 10, 'restock', 100), move('l', 30, 'restock', 200), move('l', -3, 'sale', null, 400)])
    const total = sumStats([statsFor(stats, 's'), statsFor(stats, 'l')])
    expect(total.stock).toBe(37)
    expect(total.sold).toBe(3)
    expect(total.revenue).toBe(1200)
    expect(total.avgCost).toBe(175)
  })
})

describe('signedQty', () => {
  it('makes stock in positive and stock out negative', () => {
    expect(signedQty('restock', -4)).toBe(4)
    expect(signedQty('giveaway', 2)).toBe(-2)
    expect(signedQty('damaged', -2)).toBe(-2)
  })
  it('keeps the sign of a count fix', () => {
    expect(signedQty('count_fix', -3)).toBe(-3)
    expect(signedQty('count_fix', 3)).toBe(3)
  })
})

describe('unitCostOf', () => {
  it('spreads the total cost over every unit', () => expect(unitCostOf(5000, [{ qty: 10 }, { qty: 15 }])).toBe(200))
  it('rounds to paise', () => expect(unitCostOf(100, [{ qty: 3 }])).toBe(33.33))
  it('is null with no units or no cost', () => {
    expect(unitCostOf(100, [{ qty: 0 }])).toBeNull()
    expect(unitCostOf(0, [{ qty: 5 }])).toBeNull()
  })
})

describe('small helpers', () => {
  it('uses the variant price, falling back to the item price', () => {
    expect(variantPrice({ price: 500 }, { price: null })).toBe(500)
    expect(variantPrice({ price: 500 }, { price: 600 })).toBe(600)
  })
  it('flags low stock only when a level is set', () => {
    expect(isLowStock({ low_stock_at: 5 }, 5)).toBe(true)
    expect(isLowStock({ low_stock_at: 5 }, 6)).toBe(false)
    expect(isLowStock({ low_stock_at: null }, 0)).toBe(false)
  })
  it('works out the count fix', () => {
    expect(countFixFor(12, 10)).toBe(-2)
    expect(countFixFor(12, 12)).toBe(0)
  })
  it('parses variant labels', () => {
    expect(parseVariantLabels('S, M,  l ,M\nXL')).toEqual(['S', 'M', 'l', 'XL'])
    expect(parseVariantLabels('  ')).toEqual(['One size'])
  })
})

describe('sales helpers', () => {
  it('adds up takings across payment methods', () => {
    expect(saleTakings({ cash_amount: 1000, upi_amount: 1500.5, card_amount: 0 })).toBe(2500.5)
  })
  it('works out what units should have brought in', () => {
    expect(expectedTotal([{ qty: 3, price: 500 }, { qty: 2, price: 200 }, { qty: -1, price: 100 }])).toBe(1900)
  })
  it('works out units sold from an end-of-night count', () => {
    expect(soldFromCount(20, 12)).toEqual({ sold: 8 })
    expect(soldFromCount(5, 5)).toEqual({ sold: 0 })
    expect(soldFromCount(3, 4)).toEqual({ error: 'More came back than went out.' })
    expect(soldFromCount(-1, 0)).toEqual({ error: 'Counts can’t be negative.' })
  })
  it('groups sales by show, newest first, with no-show sales on their own', () => {
    const groups = groupSalesByShow([
      { show_id: 'a', date: '2026-11-01' },
      { show_id: null, date: '2026-11-10' },
      { show_id: 'a', date: '2026-11-02' },
      { show_id: 'b', date: '2026-11-05' },
    ])
    expect(groups.map(g => [g.showId, g.sales.length])).toEqual([[null, 1], ['b', 1], ['a', 2]])
  })
})
