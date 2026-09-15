import { getCachedUser } from '@/lib/data'
import { PushSubscribeToggle } from '@/components/settings/PushSubscribeToggle'
import { TestNotificationButton } from '@/components/settings/TestNotificationButton'

export default async function SettingsPage() {
  const { data: { user } } = await getCachedUser()

  return (
    <div className="max-w-xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Settings</h1>

      <section className="rounded-xl border border-brand-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">Notifications</h2>
        <p className="mb-4 text-sm text-gray-500">Get notified on this device, even when the app isn&apos;t open.</p>
        <PushSubscribeToggle />
        {user && (
          <div className="mt-4 border-t border-brand-100 pt-4">
            <TestNotificationButton userId={user.id} />
          </div>
        )}
      </section>
    </div>
  )
}
