import { getSettingsContext } from '@/lib/settings-data'
import { SettingsHeader } from '@/components/settings/SettingsHeader'
import { ProfileSettings } from '@/components/settings/ProfileSettings'

export default async function ProfilePage() {
  const s = await getSettingsContext()
  return (
    <>
      <SettingsHeader eyebrow="You" title="Profile" />
      <ProfileSettings userId={s.userId} name={s.name} email={s.email} avatarUrl={s.avatarUrl} />
    </>
  )
}
