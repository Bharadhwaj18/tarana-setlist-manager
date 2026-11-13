import type { SectionLevels } from '@/lib/workspace-sections'

export interface MemberRow {
  sections: SectionLevels
  userId: string
  name: string
  role: string
  treasurer: boolean
  /** Can approve merch takings into Finance. */
  merchManager: boolean
  /** Merch crew: sees only the show kits they run. */
  merchCrew: boolean
  isYou: boolean
  /** Their profile photo, when they have one. */
  avatarUrl?: string | null
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
  /** Joins as Merch crew. */
  crew: boolean
}

export interface WorkspaceSummary {
  id: string
  name: string
  kind: string | null
  description: string | null
  color: string
  avatarUrl: string | null
}

