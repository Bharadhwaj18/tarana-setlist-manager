import type { Database } from './database'

// A freeform calendar entry that isn't a show, a task, or unavailability —
// "it can be simply anything" (a rehearsal, a deadline unrelated to a task,
// a reminder to renew something). Deliberately minimal: a title and a date
// range (single-day = start_date === end_date, same convention as
// unavailability), plus optional notes.
export type CalendarEvent = Database['public']['Tables']['calendar_events']['Row']
export type CalendarEventInsert = Omit<CalendarEvent, 'id' | 'created_at' | 'created_by'>
export type CalendarEventUpdate = Partial<CalendarEventInsert>
