import type { Database } from './database'

export type FinanceTransaction = Database['public']['Tables']['finance_transactions']['Row']
// The show entity itself lives in '@/types/shows' as `Show` — it's the base
// table Setlists and Finance both hang off now, not finance-specific.

export interface MemberBalance {
  member_id: string | null  // null = band fund
  display_name: string
  balance: number
}

// Misc sub-types and show-expense categories share one field on
// finance_transactions (category) — this is the starter set; the column
// itself is free text so new categories don't need a schema change.
//
// 'reimbursement' is special: a debit in this category (someone fronting
// a personal cost for the show — fuel, parking, etc.) is never subject to
// the standing-balance absorption floor that every other category's
// fronted expense gets — it's always paid back to them in full, and shown
// as its own distinct line in the split screen and report, never silently
// folded away just because their Band Fund balance was healthy enough to
// "cover" it. See settlement's per-show reimbursement computation.
export const TRANSACTION_CATEGORIES = ['travel', 'food', 'equipment', 'venue', 'media', 'sound', 'reimbursement', 'misc'] as const
export type TransactionCategory = typeof TRANSACTION_CATEGORIES[number]
