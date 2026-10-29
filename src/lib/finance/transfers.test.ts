import { describe, expect, it } from 'vitest'
import { holderColumns, moveDescriptions, validateMove } from './transfers'
import { accountValue } from './accounts'
import { isTransfer, summarise } from './totals'
import { categoryLabel, DEFAULT_FINANCE_SETTINGS, TRANSFER_KEY } from './settings'

const bank = accountValue('bank-1')
const cash = accountValue('cash-1')

describe('holderColumns', () => {
  it('puts an account and a member in their own columns', () => {
    expect(holderColumns(bank)).toEqual({ account: 'bank-1', member: null })
    expect(holderColumns('user-1')).toEqual({ account: null, member: 'user-1' })
  })
  it('rejects empty and broken values', () => {
    expect(holderColumns('')).toBeNull()
    expect(holderColumns('acct:')).toBeNull()
  })
})

describe('validateMove', () => {
  it('allows account to account, and account with a pocket either way', () => {
    expect(validateMove(cash, bank, 3000)).toBeNull()
    expect(validateMove('user-1', bank, 500)).toBeNull()
    expect(validateMove(bank, 'user-1', 2000)).toBeNull()
  })
  it('turns down moves that make no sense', () => {
    expect(validateMove(bank, bank, 100)).toMatch(/two different/)
    expect(validateMove('user-1', 'user-2', 100)).toMatch(/band account/)
    expect(validateMove('', bank, 100)).toMatch(/Choose where/)
    expect(validateMove(cash, bank, 0)).toMatch(/above zero/)
    expect(validateMove(cash, bank, Number.NaN)).toMatch(/above zero/)
    expect(validateMove(cash, bank, -5)).toMatch(/above zero/)
  })
})

describe('moveDescriptions', () => {
  it('names the other side, with the note when there is one', () => {
    expect(moveDescriptions('Cash box', 'Band account')).toEqual({ out: 'Moved to Band account', in: 'Moved from Cash box' })
    expect(moveDescriptions('Cash box', 'Band account', ' Deposited at the branch ')).toEqual({
      out: 'Moved to Band account · Deposited at the branch', in: 'Moved from Cash box · Deposited at the branch',
    })
  })
  it('stays within the length the database accepts', () => {
    const d = moveDescriptions('A', 'B', 'x'.repeat(500))
    expect(d.out.length).toBeLessThanOrEqual(300)
    expect(d.in.length).toBeLessThanOrEqual(300)
  })
})

describe('transfers in reports', () => {
  const entries = [
    { amount: 36000, category: 'show_fee' },
    { amount: -3000, category: 'sound' },
    { amount: -3000, category: TRANSFER_KEY },
    { amount: 3000, category: TRANSFER_KEY },
  ]
  it('are recognised', () => {
    expect(isTransfer({ category: TRANSFER_KEY })).toBe(true)
    expect(isTransfer({ category: 'sound' })).toBe(false)
    expect(isTransfer({ category: null })).toBe(false)
  })
  it('are neither income nor spending, nor counted as entries', () => {
    expect(summarise(entries)).toEqual({ moneyIn: 36000, moneyOut: 3000, net: 33000, payouts: 0, count: 2 })
  })
  it('have a readable name', () => {
    expect(categoryLabel(DEFAULT_FINANCE_SETTINGS, TRANSFER_KEY)).toBe('Moved money')
  })
})
