import { SettingsHeader } from '@/components/settings/SettingsHeader'
import { ThemePicker } from '@/components/ui/ThemeToggle'

export default function AppearancePage() {
  return (
    <>
      <SettingsHeader eyebrow="You" title="Appearance" />
      <section className="max-w-xl rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
        <p className="mb-4 text-sm text-gray-500">Light, dark, or follow this device. Saved on this device only.</p>
        <ThemePicker />
      </section>
    </>
  )
}
