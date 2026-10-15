import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { getSettingsContext, getSettingsMembers } from '@/lib/settings-data'
import { settingsItems } from '@/lib/settings-sections'
import { getWorkspaceOptions } from '@/lib/workspace-options-server'
import { SettingsList } from '@/components/settings/SettingsNav'
import { ProfileSettings } from '@/components/settings/ProfileSettings'
import { SettingsHeader } from '@/components/settings/SettingsHeader'
import { UserAvatar } from '@/components/ui/UserAvatar'

/** Phones: the list of everything in Settings. Desktop: the menu is on the left, so this opens on Profile. */
export default async function SettingsPage() {
  const [s, { options, currentId }] = await Promise.all([getSettingsContext(), getWorkspaceOptions()])
  const items = settingsItems({ isPersonal: s.isPersonal, isAdmin: s.isAdmin, workspaceName: s.workspace.name })
  const admins = !s.isAdmin && !s.isPersonal
    ? (await getSettingsMembers()).filter(m => m.role === 'owner' || m.role === 'admin').map(m => m.name)
    : []
  const footnote = s.isPersonal
    ? 'Your personal space is just you, so there are no members or invites to manage.'
    : !s.isAdmin
      ? `Only admins can change workspace settings.${admins.length ? ` ${admins.join(', ')} ${admins.length === 1 ? 'is the admin' : 'are admins'} here.` : ''}`
      : undefined

  return (
    <>
      <div className="space-y-3 lg:hidden">
        <h1 className="font-display text-3xl font-bold text-gray-900">Settings</h1>
        <Link href="/settings/profile" className="flex items-center gap-3.5 rounded-2xl border border-brand-200 bg-white p-3.5 active:bg-brand-50">
          <UserAvatar name={s.name} id={s.userId} avatarUrl={s.avatarUrl} size={56} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[17px] font-extrabold text-gray-900">{s.name || 'Add your name'}</span>
            <span className="block truncate text-[13px] text-gray-500">{s.email}</span>
            <span className="mt-0.5 block text-xs font-bold text-brand-600">Edit profile and photo</span>
          </span>
          <ChevronRight className="h-[18px] w-[18px] shrink-0 text-gray-400" />
        </Link>
        <SettingsList items={items} workspaces={options} currentId={currentId} footnote={footnote} />
      </div>
      <div className="hidden lg:block">
        <SettingsHeader eyebrow="You" title="Profile" />
        <ProfileSettings userId={s.userId} name={s.name} email={s.email} avatarUrl={s.avatarUrl} />
      </div>
    </>
  )
}
