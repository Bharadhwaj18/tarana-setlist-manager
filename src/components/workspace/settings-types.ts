import type { SectionLevels } from '@/lib/workspace-sections'

export interface MemberRow {
  sections: SectionLevels
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
  /** Access a member joining with this link gets; null means everything. */
  sections: SectionLevels | null
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
  { key: 'money', label: 'Money' },
  { key: 'danger', label: 'Danger zone' },
] as const
export type SettingsTab = (typeof SETTINGS_TABS)[number]['key']
