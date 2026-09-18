import type { Database } from './database'

export type FinanceTransaction = Database['public']['Tables']['finance_transactions']['Row']
// The show entity itself lives in '@/types/shows' as `Show` — it's the base
// table Setlists and Finance both hang off now, not finance-specific.

export interface MemberBalance {
  member_id: string | null  // null = band fund
  display_name: string
  balance: number
}

// Sub-types share one field on finance_transactions (category) — the
// column itself is free text so new categories don't need a schema
// change. Debit and credit each get their own starter set since they
// describe opposite things (money going out vs. coming in) — the "Sub
// type" dropdown in AddTransactionModal picks whichever list matches the
// currently-selected direction.
//
// 'reimbursement' is special: a debit in this category (someone fronting
// a personal cost for the show — fuel, parking, etc.) is never subject to
// the standing-balance absorption floor that every other category's
// fronted expense gets — it's always paid back to them in full, and shown
// as its own distinct line in the split screen and report, never silently
// folded away just because their Band Fund balance was healthy enough to
// "cover" it. See settlement's per-show reimbursement computation.
export const DEBIT_CATEGORIES = ['travel', 'food', 'equipment', 'venue', 'media', 'sound', 'reimbursement', 'misc'] as const
export type DebitCategory = typeof DEBIT_CATEGORIES[number]

// Money coming in — a show fee, a sponsorship, merch sales, or a member
// depositing personal money into Band Fund. Deliberately no "advance"
// entry: an advance is just a show fee that happens to land before the
// gig, not a different kind of money.
export const CREDIT_CATEGORIES = ['show_fee', 'sponsorship', 'merch', 'member_contribution', 'misc'] as const
export type CreditCategory = typeof CREDIT_CATEGORIES[number]

export const CREDIT_CATEGORY_LABELS: Record<CreditCategory, string> = {
  show_fee: 'Show fee',
  sponsorship: 'Sponsorship',
  merch: 'Merch',
  member_contribution: 'Member contribution',
  misc: 'Misc',
}
