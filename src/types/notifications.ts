import type { Database } from './database'

// A persistent notification record — the source of truth for both the
// in-app bell/inbox and the push payload sent to a recipient's devices, so
// the two are never out of sync. sender_id is null for system-generated
// notifications (e.g. a task-due reminder from the cron job).
export type AppNotification = Database['public']['Tables']['notifications']['Row']
export type AppNotificationInsert = Omit<AppNotification, 'id' | 'created_at' | 'read_at'>
export type AppNotificationUpdate = Partial<AppNotificationInsert>

// One subscribed device/browser for a profile — a person can have several
// (phone + laptop, say), each gets pushed to independently.
export type PushSubscriptionRow = Database['public']['Tables']['push_subscriptions']['Row']
export type PushSubscriptionInsert = Omit<PushSubscriptionRow, 'id' | 'created_at'>

/**
 * A notification with its sender already resolved to a plain display
 * string server-side (never a function — see the server/client boundary
 * rule this app has been bitten by before). senderName is null for a
 * system-generated notification (e.g. a cron due-date reminder).
 */
export interface NotificationItem {
  id: string
  title: string
  body: string | null
  link: string | null
  read: boolean
  createdAt: string
  senderName: string | null
}
