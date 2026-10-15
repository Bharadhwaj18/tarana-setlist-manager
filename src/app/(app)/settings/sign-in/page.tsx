import { SettingsHeader } from '@/components/settings/SettingsHeader'
import { PasswordSettings } from '@/components/settings/PasswordSettings'

export default function SignInSettingsPage() {
  return (
    <>
      <SettingsHeader eyebrow="You" title="Sign-in" />
      <PasswordSettings />
    </>
  )
}
