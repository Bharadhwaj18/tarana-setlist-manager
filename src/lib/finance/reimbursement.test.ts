import { describe, it, expect } from 'vitest'
import { computeAutoReimbursement } from './reimbursement'

describe('computeAutoReimbursement', () => {
  it('reimburses nothing when the standing balance fully covers the expense', () => {
    expect(computeAutoReimbursement(25_000, 20_000)).toBe(0)
  })

  it('reimburses nothing when the balance exactly covers the expense', () => {
    expect(computeAutoReimbursement(20_000, 20_000)).toBe(0)
  })

  it('reimburses only the shortfall, not the full amount — the worked example from the proposal', () => {
    expect(computeAutoReimbursement(8_000, 20_000)).toBe(12_000)
  })

  it('reimburses the full amount when standing balance is zero', () => {
    expect(computeAutoReimbursement(0, 12_000)).toBe(12_000)
  })

  it('reimburses enough to bring an already-negative balance back to exactly zero', () => {
    expect(computeAutoReimbursement(-5_000, 1_000)).toBe(6_000)
  })
})
