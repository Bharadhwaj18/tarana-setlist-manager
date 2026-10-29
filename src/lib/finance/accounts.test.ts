import { describe, expect, it } from 'vitest'
import { accountBalances, accountIdOf, accountValue, activeAccounts, holderName, toAccount } from './accounts'

describe('account values', () => {
  it('round-trips an id and ignores member ids', () => {
    expect(accountIdOf(accountValue('abc'))).toBe('abc')
    expect(accountIdOf('2f6c0e1a-0000-0000-0000-000000000000')).toBeNull()
    expect(accountIdOf('acct:')).toBeNull()
  })
})

describe('accountBalances', () => {
  it('adds up each account and ignores member entries', () => {
    const entries = [
      { amount: 36000, account_id: 'a' }, { amount: -3000, account_id: 'a' }, { amount: 3200, account_id: 'b' },
      { amount: -2000, account_id: null },
    ]
    expect(accountBalances(entries)).toEqual({ a: 33000, b: 3200 })
  })
  it('avoids floating-point drift', () => {
    expect(accountBalances([{ amount: 0.1, account_id: 'a' }, { amount: 0.2, account_id: 'a' }])).toEqual({ a: 0.3 })
  })
  it('starts at nothing: no entries, no balance', () => {
    expect(accountBalances([])).toEqual({})
  })
})

describe('toAccount / activeAccounts', () => {
  const rows = [
    { id: '1', name: 'Band account', kind: 'bank', held_by: null, upi_id: 'tarana@okhdfc', archived_at: null },
    { id: '2', name: 'Old box', kind: 'cash', held_by: 'u1', upi_id: null, archived_at: '2026-10-01T00:00:00Z' },
  ].map(toAccount)
  it('maps rows', () => {
    expect(rows[0]).toEqual({ id: '1', name: 'Band account', kind: 'bank', heldBy: null, upiId: 'tarana@okhdfc', archived: false })
    expect(rows[1].kind).toBe('cash')
    expect(rows[1].archived).toBe(true)
  })
  it('keeps only the ones that can take entries', () => {
    expect(activeAccounts(rows).map(a => a.id)).toEqual(['1'])
  })
})

describe('holderName', () => {
  const accounts = [{ id: '1', name: 'Band account', kind: 'bank' as const, heldBy: null, upiId: null, archived: false }]
  const member = (id: string | null) => (id === 'u1' ? 'Raga' : 'Unattributed')
  it('prefers the account, then the member', () => {
    expect(holderName({ account_id: '1', member_id: null }, accounts, member)).toBe('Band account')
    expect(holderName({ account_id: null, member_id: 'u1' }, accounts, member)).toBe('Raga')
    expect(holderName({ account_id: null, member_id: null }, accounts, member)).toBe('Unattributed')
  })
})
