import type { Database } from './database'

export type FinanceShow = Database['public']['Tables']['finance_shows']['Row']
export type FinanceTransaction = Database['public']['Tables']['finance_transactions']['Row']

export interface MemberBalance {
  member_id: string | null  // null = band fund
  display_name: string
  balance: number
}

// Misc sub-types and show-expense categories share one field on
// finance_transactions (category) — this is the starter set; the column
// itself is free text so new categories don't need a schema change.
export const TRANSACTION_CATEGORIES = ['travel', 'food', 'equipment', 'venue', 'media', 'sound', 'misc'] as const
export type TransactionCategory = typeof TRANSACTION_CATEGORIES[number]
