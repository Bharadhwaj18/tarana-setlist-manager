import { describe, expect, it } from 'vitest'
import { balanceDifference, checkState, daysSince, latestChecks, toCheck, type BalanceCheck } from './reconcile'

const check = (o: Partial<BalanceCheck> = {}): BalanceCheck => ({
  id: 'c1', accountId: 'a1', checkedOn: '2026-10-20', bank: 1000, recorded: 1000, difference: 0, note: null, corrected: false, checkedBy: 'u1', createdAt: '2026-10-20T10:00:00Z', ...o,
})

describe('balanceDifference', () => {
  it('is bank minus the app, to the paisa', () => {
    expect(balanceDifference(1000.1, 1000)).toBe(0.1)
    expect(balanceDifference(900, 1000)).toBe(-100)
    expect(balanceDifference(0.3, 0.1 + 0.2)).toBe(0)
  })
})

describe('daysSince', () => {
  it('counts whole days and never goes negative', () => {
    expect(daysSince('2026-10-01', '2026-10-29')).toBe(28)
    expect(daysSince('2026-10-29', '2026-10-29')).toBe(0)
    expect(daysSince('2026-11-05', '2026-10-29')).toBe(0)
  })
})

describe('checkState', () => {
  const today = '2026-10-29'
  it('is never with no check', () => expect(checkState(undefined, today)).toBe('never'))
  it('is matched when there was no difference', () => expect(checkState(check(), today)).toBe('matched'))
  it('is off when there was a difference nobody fixed', () => expect(checkState(check({ difference: -50 }), today)).toBe('off'))
  it('is fixed when a correction was made', () => expect(checkState(check({ difference: -50, corrected: true }), today)).toBe('fixed'))
  it('is stale after 30 days, even if it matched', () => expect(checkState(check({ checkedOn: '2026-09-20' }), today)).toBe('stale'))
})

describe('latestChecks', () => {
  it('keeps the newest per account', () => {
    const out = latestChecks([
      check({ id: 'old', checkedOn: '2026-10-01' }),
      check({ id: 'new', checkedOn: '2026-10-20' }),
      check({ id: 'other', accountId: 'a2', checkedOn: '2026-09-01' }),
    ])
    expect(out.a1.id).toBe('new')
    expect(out.a2.id).toBe('other')
  })
  it('breaks a same-day tie by when it was saved', () => {
    const out = latestChecks([check({ id: 'first' }), check({ id: 'second', createdAt: '2026-10-20T15:00:00Z' })])
    expect(out.a1.id).toBe('second')
  })
})

describe('toCheck', () => {
  it('marks a check corrected when it has an adjustment', () => {
    const c = toCheck({ id: 'x', account_id: 'a', checked_on: '2026-10-20', bank_balance: 5, recorded_balance: 4, difference: 1, note: null, adjustment_id: 'adj', checked_by: 'u', created_at: 't' })
    expect(c.corrected).toBe(true)
    expect(c.difference).toBe(1)
  })
})
