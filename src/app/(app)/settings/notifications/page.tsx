import { getSettingsContext } from '@/lib/settings-data'
import { SettingsHeader } from '@/components/settings/SettingsHeader'
import { PushSubscribeToggle } from '@/components/settings/PushSubscribeToggle'
import { TestNotificationButton } from '@/components/settings/TestNotificationButton'

export default async function NotificationsSettingsPage() {
  const s = await getSettingsContext()
  return (
    <>
      <SettingsHeader eyebrow="You" title="Notifications" />
      <section className="max-w-xl rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
        <p className="mb-4 text-sm text-gray-500">Get notified on this device, even when the app isn’t open. Turn it on separately on each phone or computer.</p>
        <PushSubscribeToggle />
        <div className="mt-4 border-t border-brand-100 pt-4">
          <TestNotificationButton userId={s.userId} />
        </div>
      </section>
    </>
  )
}
