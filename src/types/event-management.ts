import type { Database } from './database'

// A repeat agency/company a show can be booked through — as opposed to a
// one-off individual client, which just lives as free text on the show
// itself (poc_name/poc_phone/poc_email). See shows.event_management_id.
export type EventManagement = Database['public']['Tables']['event_management']['Row']
export type EventManagementInsert = Omit<EventManagement, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>
export type EventManagementUpdate = Partial<EventManagementInsert>
