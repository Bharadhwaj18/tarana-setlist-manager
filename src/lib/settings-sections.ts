/** Every page in Settings, in order, and who gets to see it. Used for the phone list and the desktop menu. */

export type SettingsIcon = 'profile' | 'signin' | 'appearance' | 'notifications' | 'general' | 'members' | 'invites' | 'money' | 'leave'

export interface SettingsItem {
  key: SettingsIcon
  href: string
  label: string
  section: 'you' | 'workspace'
  /** Short right-hand hint on the phone list. */
  hint?: string
  /** Small pill, e.g. "View only". */
  pill?: string
  danger?: boolean
}

export interface SettingsWho {
  isPersonal: boolean
  isAdmin: boolean
  workspaceName: string
}

export function settingsItems(who: SettingsWho): SettingsItem[] {
  const items: SettingsItem[] = [
    { key: 'profile', href: '/settings/profile', label: 'Profile', section: 'you', hint: 'Name and photo' },
    { key: 'signin', href: '/settings/sign-in', label: 'Sign-in', section: 'you', hint: 'Password' },
    { key: 'appearance', href: '/settings/appearance', label: 'Appearance', section: 'you', hint: 'Light or dark' },
    { key: 'notifications', href: '/settings/notifications', label: 'Notifications', section: 'you', hint: 'This device' },
  ]
  if (!who.isPersonal) {
    items.push(
      { key: 'general', href: '/settings/workspace', label: 'General', section: 'workspace', ...(who.isAdmin ? { hint: 'Name, logo, colour' } : { pill: 'View only' }) },
      { key: 'members', href: '/settings/members', label: 'Members', section: 'workspace', ...(who.isAdmin ? { hint: 'People and access' } : { pill: 'View only' }) },
    )
    if (who.isAdmin) items.push({ key: 'invites', href: '/settings/invites', label: 'Invites', section: 'workspace', hint: 'Invite links' })
  }
  // Money settings are for admins only, always (the owner of a personal space is its admin).
  if (who.isAdmin) items.push({ key: 'money', href: '/settings/money', label: 'Money', section: 'workspace', pill: who.isPersonal ? undefined : 'Admins' })
  if (!who.isPersonal) {
    items.push({ key: 'leave', href: '/settings/leave', label: who.isAdmin ? 'Leave or delete' : `Leave ${who.workspaceName}`, section: 'workspace', danger: true })
  }
  return items
}
