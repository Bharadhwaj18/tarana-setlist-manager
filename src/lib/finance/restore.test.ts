import { describe, expect, it } from 'vitest'
import { canUndoDelete, transactionToInput } from './restore'
import type { FinanceTransaction } from '@/types/finance'

const row = (o: Partial<FinanceTransaction> = {}) => ({
  id: 'x', workspace_id: 'w', member_id: 'm', account_id: null, amount: -500, description: 'Cab', category: 'travel',
  show_id: null, budget_id: null, project_id: null, tags: ['tour'], date: '2026-10-20', recorded_by: 'u', created_at: 't', transfer_id: null, ...o,
}) as FinanceTransaction

describe('transactionToInput', () => {
  it('keeps what the add form saves and drops what was generated', () => {
    const input = transactionToInput(row())
    expect(input).toEqual({ member_id: 'm', account_id: null, amount: -500, description: 'Cab', category: 'travel', show_id: null, budget_id: null, date: '2026-10-20', tags: ['tour'], project_id: null })
    expect(input).not.toHaveProperty('id')
    expect(input).not.toHaveProperty('workspace_id')
  })
  it('never carries null tags', () => {
    expect(transactionToInput(row({ tags: null as unknown as string[] })).tags).toEqual([])
  })
})

describe('canUndoDelete', () => {
  it('is false for a move, true for anything else', () => {
    expect(canUndoDelete({ transfer_id: 't1' })).toBe(false)
    expect(canUndoDelete({ transfer_id: null })).toBe(true)
  })
})
