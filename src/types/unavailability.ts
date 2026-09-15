import type { Database } from './database'

// A member being unavailable for a date range — single-day is just
// start_date === end_date, one shape covers both. Purely additive to the
// Calendar; nothing else in the app reads this table.
export type Unavailability = Database['public']['Tables']['unavailability']['Row']
export type UnavailabilityInsert = Omit<Unavailability, 'id' | 'created_at'>
export type UnavailabilityUpdate = Partial<UnavailabilityInsert>
