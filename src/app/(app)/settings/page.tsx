import { PushSubscribeToggle } from '@/components/settings/PushSubscribeToggle'

export default function SettingsPage() {
  return (
    <div className="max-w-xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Settings</h1>

      <section className="rounded-xl border border-brand-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">Notifications</h2>
        <p className="mb-4 text-sm text-gray-500">Get notified on this device, even when the app isn&apos;t open.</p>
        <PushSubscribeToggle />
      </section>
    </div>
  )
}
