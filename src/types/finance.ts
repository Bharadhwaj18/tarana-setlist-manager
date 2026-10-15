import type { Database } from './database'

export type FinanceTransaction = Database['public']['Tables']['finance_transactions']['Row']
// The show entity itself lives in '@/types/shows' as `Show` — it's the base
// table Setlists and Finance both hang off now, not finance-specific.

export interface MemberBalance {
  member_id: string | null  // null = band fund
  display_name: string
  balance: number
}

// Categories are per workspace now: see DEFAULT_CATEGORIES and the money settings in lib/finance/settings.ts.

export type FinanceProject = Database['public']['Tables']['finance_projects']['Row']
export type FinanceRecurring = Database['public']['Tables']['finance_recurring']['Row']
