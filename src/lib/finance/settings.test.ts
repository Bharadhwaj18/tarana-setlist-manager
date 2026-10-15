import { describe, it, expect } from 'vitest'
import {
  DEFAULT_FINANCE_SETTINGS, normaliseFinanceSettings, activeCategories, categoryLabel, newCategoryKey,
  formatMoney, formatMoneyPdf, describeSplitRule, splitRulesFrom, evenPercents, percentTotal,
} from './settings'
import { computeEntitlements } from './settlement'
import { occurrences, nextOccurrence } from './recurring'

describe('normaliseFinanceSettings', () => {
  it('gives today\'s behaviour when nothing is saved', () => {
    expect(normaliseFinanceSettings(undefined)).toEqual(DEFAULT_FINANCE_SETTINGS)
    expect(normaliseFinanceSettings({})).toEqual(DEFAULT_FINANCE_SETTINGS)
  })

  it('always keeps the categories that have behaviour attached', () => {
    const s = normaliseFinanceSettings({ categories: [{ key: 'c_rent', label: 'Rent', direction: 'out' }] })
    expect(s.categories.map(c => c.key)).toEqual(['c_rent', 'misc', 'reimbursement', 'misc'])
  })

  it('never lets a locked category be hidden', () => {
    const s = normaliseFinanceSettings({ categories: [{ key: 'reimbursement', label: 'Paid back', direction: 'out', hidden: true }] })
    const r = s.categories.find(c => c.key === 'reimbursement')
    expect(r?.label).toBe('Paid back')
    expect(r?.hidden).toBeUndefined()
  })

  it('drops bad values instead of failing', () => {
    const s = normaliseFinanceSettings({
      fundPercent: 400, currency: 'XYZ', shareMode: 'odd',
      cuts: [{ id: 'a', label: 'Manager', memberId: 'm', percent: 70 }, { id: 'b', label: 'Too much', memberId: 'n', percent: 40 }],
      tags: ['Goa tour', ' Goa tour ', '', 5],
    })
    expect(s.fundPercent).toBe(100)
    expect(s.currency).toBe('INR')
    expect(s.shareMode).toBe('equal')
    expect(s.cuts.map(c => c.id)).toEqual(['a'])
    expect(s.tags).toEqual(['Goa tour'])
  })

  it('reads the old "shares" mode as ratio', () => {
    const s = normaliseFinanceSettings({ shareMode: 'shares', shares: { a: 2 } })
    expect(s.shareMode).toBe('ratio')
    expect(splitRulesFrom(s, ['a', 'b']).weights).toEqual({ a: 2, b: 1 })
  })

  it('only uses the map for the chosen mode', () => {
    const s = normaliseFinanceSettings({ shares: { a: 2 }, percents: { a: 60, b: 40 }, fixedAmounts: { a: 5000 } })
    expect(splitRulesFrom(s, ['a', 'b'])).toEqual({ weights: undefined, fixed: undefined, cuts: [] })
    expect(splitRulesFrom({ ...s, shareMode: 'percent' }, ['a', 'b']).weights).toEqual({ a: 60, b: 40 })
    expect(splitRulesFrom({ ...s, shareMode: 'fixed' }, ['a', 'b']).fixed).toEqual({ a: 5000, b: 0 })
  })

  it('makes even percentages that add up to 100', () => {
    const p = evenPercents(['a', 'b', 'c'])
    expect(p).toEqual({ a: 34, b: 33, c: 33 })
    expect(percentTotal({ ...DEFAULT_FINANCE_SETTINGS, percents: p }, ['a', 'b', 'c'])).toBe(100)
  })
})

describe('categories', () => {
  const s = normaliseFinanceSettings({
    categories: [...DEFAULT_FINANCE_SETTINGS.categories, { key: 'c_rent', label: 'Rehearsal rent', direction: 'out', hidden: true }],
  })

  it('hides hidden categories from new entries but keeps their names for old ones', () => {
    expect(activeCategories(s, 'out').some(c => c.key === 'c_rent')).toBe(false)
    expect(categoryLabel(s, 'c_rent')).toBe('Rehearsal rent')
  })

  it('names keys it no longer knows about', () => {
    expect(categoryLabel(s, 'c_old_studio')).toBe('Old studio')
    expect(categoryLabel(s, 'split')).toBe('Split payout')
    expect(categoryLabel(s, null)).toBe('Uncategorised')
  })

  it('makes unique keys for new categories', () => {
    expect(newCategoryKey('Rehearsal rent', s.categories)).toBe('c_rehearsal_rent')
    expect(newCategoryKey('Rent', [{ key: 'c_rent', label: 'Rent', direction: 'out' }])).toBe('c_rent_2')
  })
})

describe('money formatting', () => {
  it('formats in the workspace currency', () => {
    expect(formatMoney(125000, 'INR')).toBe('₹1,25,000')
    expect(formatMoney(-1200, 'USD')).toBe('$1,200')
    expect(formatMoneyPdf(125000, 'INR')).toBe('Rs. 1,25,000')
  })

  it('describes the split rule in plain words', () => {
    const s = { ...DEFAULT_FINANCE_SETTINGS, cuts: [{ id: 'x', label: 'Manager', memberId: 'm', percent: 10 }] }
    expect(describeSplitRule(s, 20, () => 'Asha')).toBe('10% to Asha (Manager) first, then 20% to the Band Fund, then the rest equally among everyone who played')
  })
})

describe('computeEntitlements with rules', () => {
  it('matches the plain equal split when every share is 1', () => {
    const plain = computeEntitlements(1000, ['a', 'b', 'c'], 20)
    const ruled = computeEntitlements(1000, ['a', 'b', 'c'], 20, {}, { weights: { a: 1, b: 1, c: 1 }, cuts: [] })
    expect(ruled.memberShares).toEqual(plain.memberShares)
    expect(ruled.bandFundAmount).toBe(plain.bandFundAmount)
  })

  it('shares by weight', () => {
    const { memberShares, bandFundAmount } = computeEntitlements(1000, ['a', 'b', 'c'], 20, {}, { weights: { a: 2 } })
    expect(bandFundAmount).toBe(200)
    expect(memberShares).toEqual({ a: 400, b: 200, c: 200 })
  })

  it('takes cuts off the top before the fund, paying the cut to its member', () => {
    const { memberShares, bandFundAmount, cutShares } = computeEntitlements(1000, ['a', 'b'], 20, {}, { cuts: [{ memberId: 'm', percent: 10 }] })
    expect(cutShares).toEqual({ m: 100 })
    expect(bandFundAmount).toBe(180)
    expect(memberShares).toEqual({ a: 360, b: 360, m: 100 })
  })

  it('adds a cut on top of the member\'s own share when they also played', () => {
    const { memberShares } = computeEntitlements(1000, ['a', 'b'], 0, {}, { cuts: [{ memberId: 'a', percent: 10 }] })
    expect(memberShares).toEqual({ a: 550, b: 450 })
  })

  it('takes no cut from a show that lost money', () => {
    const { cutShares, memberShares } = computeEntitlements(-200, ['a', 'b'], 0, {}, { cuts: [{ memberId: 'm', percent: 10 }] })
    expect(cutShares).toEqual({})
    expect(memberShares).toEqual({ a: -100, b: -100 })
  })
})

describe('percentage and fixed splits', () => {
  it('shares by percentage, and spreads an absent player\'s part over the rest', () => {
    const all = computeEntitlements(1000, ['a', 'b', 'c'], 0, {}, { weights: { a: 50, b: 30, c: 20 } })
    expect(all.memberShares).toEqual({ a: 500, b: 300, c: 200 })
    const withoutC = computeEntitlements(1000, ['a', 'b'], 0, {}, { weights: { a: 50, b: 30, c: 20 } })
    expect(withoutC.memberShares).toEqual({ a: 625, b: 375 })
  })

  it('pays fixed amounts and sends the rest to the fund', () => {
    const r = computeEntitlements(10000, ['a', 'b'], 20, {}, { fixed: { a: 3000, b: 2000 } })
    expect(r.memberShares).toEqual({ a: 3000, b: 2000 })
    expect(r.bandFundAmount).toBe(5000)
  })

  it('reduces fixed amounts evenly when the show made less', () => {
    const r = computeEntitlements(2500, ['a', 'b'], 20, {}, { fixed: { a: 3000, b: 2000 } })
    expect(r.memberShares).toEqual({ a: 1500, b: 1000 })
    expect(r.bandFundAmount).toBe(0)
  })

  it('shares a loss equally under fixed amounts', () => {
    const r = computeEntitlements(-400, ['a', 'b'], 20, {}, { fixed: { a: 3000, b: 2000 } })
    expect(r.memberShares).toEqual({ a: -200, b: -200 })
    expect(r.bandFundAmount).toBe(0)
  })

  it('takes cuts before fixed amounts', () => {
    const r = computeEntitlements(10000, ['a'], 0, {}, { fixed: { a: 5000 }, cuts: [{ memberId: 'm', percent: 10 }] })
    expect(r.memberShares).toEqual({ a: 5000, m: 1000 })
    expect(r.bandFundAmount).toBe(4000)
  })
})

describe('recurring occurrences', () => {
  it('repeats monthly and lands on the last day of short months', () => {
    expect(occurrences({ frequency: 'monthly', start_date: '2026-01-31' }, '2026-04-15')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
  })

  it('repeats weekly and stops at the end date', () => {
    expect(occurrences({ frequency: 'weekly', start_date: '2026-10-01', end_date: '2026-10-16' }, '2026-12-31')).toEqual(['2026-10-01', '2026-10-08', '2026-10-15'])
  })

  it('handles leap days on yearly rules', () => {
    expect(occurrences({ frequency: 'yearly', start_date: '2024-02-29' }, '2026-03-01')).toEqual(['2024-02-29', '2025-02-28', '2026-02-28'])
  })

  it('returns nothing before the start, and finds the next date', () => {
    expect(occurrences({ frequency: 'monthly', start_date: '2026-11-01' }, '2026-10-15')).toEqual([])
    expect(nextOccurrence({ frequency: 'monthly', start_date: '2026-01-05' }, '2026-10-15')).toBe('2026-11-05')
    expect(nextOccurrence({ frequency: 'monthly', start_date: '2026-01-05', end_date: '2026-10-10' }, '2026-10-15')).toBeNull()
  })
})

import { summarise, groupTotals } from './totals'

describe('totals', () => {
  const entries = [
    { amount: 1000, category: 'show_fee', tags: ['Goa tour'] },
    { amount: -300, category: 'travel', tags: ['Goa tour', 'Fuel'] },
    { amount: -200, category: 'food', tags: [] },
    { amount: -400, category: 'split', tags: [] },
  ]

  it('keeps split payouts out of income and spending', () => {
    expect(summarise(entries)).toEqual({ moneyIn: 1000, moneyOut: 500, net: 500, payouts: 400, count: 4 })
  })

  it('counts an entry under every tag it has, and lists untagged entries together', () => {
    const groups = groupTotals(entries, e => e.tags, k => k, 'No tag')
    expect(groups.find(g => g.key === 'Goa tour')?.totals.net).toBe(700)
    expect(groups.find(g => g.key === 'Fuel')?.totals.moneyOut).toBe(300)
    expect(groups.find(g => g.label === 'No tag')?.totals).toMatchObject({ moneyOut: 200, payouts: 400 })
  })
})
