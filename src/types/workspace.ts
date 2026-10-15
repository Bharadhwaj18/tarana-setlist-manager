import type { Database } from './database'
import type { SectionLevels } from '@/lib/workspace-sections'

export type Workspace = Database['public']['Tables']['workspaces']['Row']
export type WorkspaceMember = Database['public']['Tables']['workspace_members']['Row']

/** A user's membership in one workspace, with permissions normalised to a flat flag map. */
export interface WorkspaceMembership {
  workspace: Workspace
  role: string
  permissions: Record<string, boolean>
  /** Per-section access for this member (owners and admins are always full edit). */
  sections: SectionLevels
}

export interface WorkspaceContext {
  userId: string
  current: WorkspaceMembership
  memberships: WorkspaceMembership[]
}
