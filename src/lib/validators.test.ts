import { describe, it, expect } from 'vitest'
import { transactionInputSchema, showSchema } from './validators'

const uuid = '3f2b8c1e-4a5d-4e6f-8a9b-0c1d2e3f4a5b'

describe('transactionInputSchema', () => {
  const base = { member_id: uuid, amount: -500, description: 'Strings' }

  it('accepts a normal debit and strips unknown keys', () => {
    const r = transactionInputSchema.safeParse({ ...base, recorded_by: 'someone-else', workspace_id: 'x' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).not.toHaveProperty('recorded_by')
  })

  it('rejects zero, non-finite and absurd amounts', () => {
    expect(transactionInputSchema.safeParse({ ...base, amount: 0 }).success).toBe(false)
    expect(transactionInputSchema.safeParse({ ...base, amount: Infinity }).success).toBe(false)
    expect(transactionInputSchema.safeParse({ ...base, amount: 1e12 }).success).toBe(false)
  })

  it('rejects blank descriptions and malformed dates or ids', () => {
    expect(transactionInputSchema.safeParse({ ...base, description: '  ' }).success).toBe(false)
    expect(transactionInputSchema.safeParse({ ...base, date: '30/09/2026' }).success).toBe(false)
    expect(transactionInputSchema.safeParse({ ...base, show_id: 'nope' }).success).toBe(false)
  })
})

describe('showSchema', () => {
  it('only allows known booking statuses', () => {
    expect(showSchema.safeParse({ title: 'Gig', booking_status: 'Confirmed' }).success).toBe(true)
    expect(showSchema.safeParse({ title: 'Gig', booking_status: 'Maybe' }).success).toBe(false)
  })
})
