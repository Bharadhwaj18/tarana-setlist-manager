import type { Json } from '@/types/database'
import type { WorkspaceMembership } from '@/types/workspace'

export const WORKSPACE_COOKIE = 'tarana_workspace'

export function normalisePermissions(raw: Json | null | undefined): Record<string, boolean> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v === true]))
}

/** Cookie choice if it's one of the user's workspaces, else the oldest band workspace, else the personal one. */
export function pickCurrentWorkspace(memberships: WorkspaceMembership[], cookieValue: string | undefined): WorkspaceMembership {
  const chosen = cookieValue ? memberships.find(m => m.workspace.id === cookieValue) : undefined
  if (chosen) return chosen
  const byAge = [...memberships].sort((a, b) => a.workspace.created_at.localeCompare(b.workspace.created_at))
  return byAge.find(m => m.workspace.type !== 'personal') ?? byAge[0]
}
