import type { AppNotification, NotificationItem } from '@/types'

/**
 * Resolves each notification's sender_id to a plain display string
 * server-side — shared by the (app) layout (for the Sidebar bell) and the
 * full /notifications inbox page, so the "never pass a name-resolver
 * function to a client component" rule only needs implementing once.
 */
export function resolveNotificationItems(
  notifications: AppNotification[],
  profiles: { id: string; display_name: string | null }[],
  currentUserId: string
): NotificationItem[] {
  const senderName = (senderId: string | null) =>
    senderId === null ? null : senderId === currentUserId ? 'You' : (profiles.find(p => p.id === senderId)?.display_name ?? 'Someone')

  return notifications.map(n => ({
    id: n.id,
    title: n.title,
    body: n.body,
    link: n.link,
    read: n.read_at !== null,
    createdAt: n.created_at,
    senderName: senderName(n.sender_id),
  }))
}
