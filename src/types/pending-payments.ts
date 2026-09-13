import type { Database } from './database'

// A payer-to-recipient split payment (never a self-payment — those still
// get written straight to finance_transactions) held here until the payer
// marks it paid, at which point it becomes a real finance_transactions
// debit. See actions/finance.ts's splitShows and actions/pending-payments.ts.
export type PendingPayment = Database['public']['Tables']['pending_payments']['Row']
