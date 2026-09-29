import type { Database } from './database'
import type { FinanceTransaction } from './finance'

export type Budget = Database['public']['Tables']['budgets']['Row']
export type BudgetAdjustment = Database['public']['Tables']['budget_adjustments']['Row']

export interface BudgetProgress {
  budget: Budget
  /** Inclusive window (YYYY-MM-DD) the spend is counted over. */
  periodStart: string
  periodEnd: string | null
  spent: number
  /** Can go negative when overspent. */
  remaining: number
  /** Spent as a share of allocated, uncapped (>100 when overspent). */
  pct: number
  state: 'ok' | 'warning' | 'over'
  transactions: FinanceTransaction[]
}
