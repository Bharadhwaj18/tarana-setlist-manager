import { Bell } from 'lucide-react'
import { getCachedUser, getCachedNotifications, getCachedAllProfiles } from '@/lib/data'
import { resolveNotificationItems } from '@/lib/notifications'
import { SendNotificationModal } from '@/components/notifications/SendNotificationModal'
import { NotificationInboxList } from '@/components/notifications/NotificationInboxList'

export default async function NotificationsPage() {
  const { data: { user } } = await getCachedUser()
  const [notifications, profiles] = await Promise.all([
    user ? getCachedNotifications(user.id) : Promise.resolve([]),
    getCachedAllProfiles(),
  ])
  const items = user ? resolveNotificationItems(notifications, profiles, user.id) : []
  const members = profiles
    .filter(p => p.id !== user?.id)
    .map(p => ({ id: p.id, name: p.display_name ?? 'Member' }))

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="mt-1 text-sm text-gray-500">{items.length} notification{items.length !== 1 ? 's' : ''}</p>
        </div>
        <SendNotificationModal members={members} />
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-gray-200 py-20 text-center">
          <Bell className="h-12 w-12 text-gray-300" />
          <div>
            <p className="font-medium text-gray-500">No notifications yet</p>
            <p className="text-sm text-gray-400">Assignment pings, due-date reminders, and anything a bandmate sends you will show up here</p>
          </div>
        </div>
      ) : (
        <NotificationInboxList items={items} />
      )}
    </div>
  )
}
