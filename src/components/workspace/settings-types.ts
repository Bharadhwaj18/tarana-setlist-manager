export interface MemberRow {
  userId: string
  name: string
  role: string
  treasurer: boolean
  isYou: boolean
}

export interface InviteRow {
  id: string
  token: string
  role: string
  expiresAt: string
  maxUses: number | null
  useCount: number
}

export interface WorkspaceSummary {
  id: string
  name: string
  kind: string | null
  description: string | null
  color: string
  avatarUrl: string | null
}

export const SETTINGS_TABS = [
  { key: 'general', label: 'General' },
  { key: 'members', label: 'Members' },
  { key: 'invites', label: 'Invites' },
  { key: 'danger', label: 'Danger zone' },
] as const
export type SettingsTab = (typeof SETTINGS_TABS)[number]['key']
