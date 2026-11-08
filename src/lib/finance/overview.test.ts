import { describe, expect, it } from 'vitest'
import { balancesByWorkspace, totalsByCurrency } from './overview'

describe('balancesByWorkspace', () => {
  it('adds each workspace separately and skips reimbursements', () => {
    const out = balancesByWorkspace([
      { workspace_id: 'a', amount: 100.1, category: null },
      { workspace_id: 'a', amount: 0.2, category: 'gig' },
      { workspace_id: 'a', amount: -50, category: 'reimbursement' },
      { workspace_id: 'b', amount: -30, category: null },
    ])
    expect(out).toEqual({ a: 100.3, b: -30 })
  })
})

describe('totalsByCurrency', () => {
  it('keeps currencies apart', () => {
    expect(totalsByCurrency([{ currency: 'INR', balance: 10 }, { currency: 'USD', balance: 5 }, { currency: 'INR', balance: -4 }]))
      .toEqual([{ currency: 'INR', total: 6 }, { currency: 'USD', total: 5 }])
  })
})
