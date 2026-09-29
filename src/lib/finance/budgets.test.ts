import { describe, it, expect } from 'vitest'
import { computeBudgetProgress, unallocatedFund, budgetPeriod } from './budgets'
import type { Budget } from '@/types/budget'
import type { FinanceTransaction } from '@/types/finance'

const budget = (o: Partial<Budget> = {}): Budget => ({
  id: 'b1', name: 'Gear', allocated_amount: 1000, recurrence: 'none', start_date: '2026-09-01',
  end_date: null, status: 'active', created_by: 'u', created_at: '', workspace_id: null, ...o,
})
const txn = (o: Partial<FinanceTransaction>): FinanceTransaction => ({
  id: Math.random().toString(), member_id: 'u', amount: -100, description: '', category: 'misc',
  show_id: null, budget_id: 'b1', date: '2026-09-10', recorded_by: 'u', created_at: '', workspace_id: null, ...o,
})

describe('computeBudgetProgress', () => {
  it('sums tagged debits and ignores other budgets and credits', () => {
    const p = computeBudgetProgress(budget(), [txn({ amount: -300 }), txn({ amount: -200 }), txn({ budget_id: 'x' }), txn({ amount: 50 })], '2026-09-20')
    expect(p.spent).toBe(500)
    expect(p.remaining).toBe(500)
    expect(p.state).toBe('ok')
  })
  it('warns near the limit and flags overspend', () => {
    expect(computeBudgetProgress(budget(), [txn({ amount: -850 })], '2026-09-20').state).toBe('warning')
    const over = computeBudgetProgress(budget(), [txn({ amount: -1200 })], '2026-09-20')
    expect(over.state).toBe('over')
    expect(over.remaining).toBe(-200)
  })
  it('monthly budgets count only the current month', () => {
    const b = budget({ recurrence: 'monthly' })
    const p = computeBudgetProgress(b, [txn({ date: '2026-08-31', amount: -400 }), txn({ date: '2026-09-02', amount: -100 })], '2026-09-20')
    expect(p.spent).toBe(100)
    expect(budgetPeriod(b, '2026-09-20')).toEqual({ start: '2026-09-01', end: '2026-09-30' })
  })
  it('respects end_date on one-off budgets', () => {
    const p = computeBudgetProgress(budget({ end_date: '2026-09-15' }), [txn({ date: '2026-09-16', amount: -100 }), txn({ date: '2026-09-15', amount: -50 })], '2026-09-20')
    expect(p.spent).toBe(50)
  })
})

describe('unallocatedFund', () => {
  it('subtracts only remaining of active budgets', () => {
    const a = computeBudgetProgress(budget(), [txn({ amount: -400 })], '2026-09-20')
    const closed = computeBudgetProgress(budget({ id: 'b2', status: 'closed' }), [], '2026-09-20')
    const over = computeBudgetProgress(budget({ id: 'b3', allocated_amount: 100 }), [txn({ budget_id: 'b3', amount: -500 })], '2026-09-20')
    expect(unallocatedFund(5000, [a, closed, over])).toBe(4400)
  })
})
