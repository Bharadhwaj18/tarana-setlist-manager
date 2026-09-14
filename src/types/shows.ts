import type { Database } from './database'

// The canonical "show" entity — one row per gig, whatever else hangs off
// it (a setlist via setlists.show_id, finance transactions via
// finance_transactions.show_id). Used across Shows, Setlists, and Finance.
export type Show = Database['public']['Tables']['shows']['Row']
export type ShowInsert = Omit<Show, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by' | 'split_at'>
export type ShowUpdate = Partial<ShowInsert>

// The booking pipeline a private-show inquiry moves through before/after it
// becomes a confirmed gig. Free-text-but-app-controlled, same convention as
// finance_transactions.category (see TRANSACTION_CATEGORIES).
export const BOOKING_STATUSES = ['Inquiry', 'Quotation Shared', 'Confirmed', 'Advance Received', 'Completed'] as const
export type BookingStatus = typeof BOOKING_STATUSES[number]
