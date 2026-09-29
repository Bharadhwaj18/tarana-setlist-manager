import type { Budget, BudgetProgress } from '@/types/budget'
import type { FinanceTransaction } from '@/types/finance'

const round2 = (n: number) => Math.round(n * 100) / 100

function monthBounds(today: string): { start: string; end: string } {
  const [y, m] = today.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const mm = String(m).padStart(2, '0')
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(last).padStart(2, '0')}` }
}

/** The date window a budget's spend is counted over. Monthly = the current calendar month (clipped to start/end). */
export function budgetPeriod(budget: Budget, today: string): { start: string; end: string | null } {
  if (budget.recurrence === 'monthly') {
    const { start, end } = monthBounds(today)
    const s = start > budget.start_date ? start : budget.start_date
    const e = budget.end_date && budget.end_date < end ? budget.end_date : end
    return { start: s, end: e }
  }
  return { start: budget.start_date, end: budget.end_date }
}

export function computeBudgetProgress(budget: Budget, txns: FinanceTransaction[], today: string): BudgetProgress {
  const { start, end } = budgetPeriod(budget, today)
  const transactions = txns
    .filter(t => t.budget_id === budget.id && t.amount < 0 && t.date >= start && (end === null || t.date <= end))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  const spent = round2(transactions.reduce((s, t) => s - t.amount, 0))
  const remaining = round2(budget.allocated_amount - spent)
  const pct = budget.allocated_amount > 0 ? (spent / budget.allocated_amount) * 100 : spent > 0 ? 100 : 0
  const state = spent > budget.allocated_amount ? 'over' : pct >= 80 ? 'warning' : 'ok'
  return { budget, periodStart: start, periodEnd: end, spent, remaining, pct, state, transactions }
}

/** Band fund money not earmarked by an active budget's remaining balance. */
export function unallocatedFund(fundTotal: number, progress: BudgetProgress[]): number {
  const earmarked = progress
    .filter(p => p.budget.status === 'active')
    .reduce((s, p) => s + Math.max(p.remaining, 0), 0)
  return round2(fundTotal - earmarked)
}
