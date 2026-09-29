import { cache } from 'react'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getCachedUser } from '@/lib/auth-cache'
import { WORKSPACE_COOKIE, pickCurrentWorkspace, normalisePermissions } from '@/lib/workspace-shared'
import type { WorkspaceContext, WorkspaceMembership } from '@/types/workspace'

/**
 * The signed-in user's workspaces plus which one is currently selected
 * (cookie, validated against their memberships — a stale or forged cookie
 * just falls back to the default). Null when signed out or, defensively,
 * when the user somehow has no membership at all.
 */
export const getWorkspaceContext = cache(async (): Promise<WorkspaceContext | null> => {
  const { data: { user } } = await getCachedUser()
  if (!user) return null

  const supabase = await createClient()
  const { data: members } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, permissions')
    .eq('user_id', user.id)
  if (!members?.length) return null

  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('*')
    .in('id', members.map(m => m.workspace_id))
  if (!workspaces?.length) return null

  const memberships: WorkspaceMembership[] = members
    .map(m => {
      const workspace = workspaces.find(w => w.id === m.workspace_id)
      return workspace ? { workspace, role: m.role, permissions: normalisePermissions(m.permissions) } : null
    })
    .filter((m): m is WorkspaceMembership => m !== null)
  if (!memberships.length) return null

  const cookieStore = await cookies()
  const current = pickCurrentWorkspace(memberships, cookieStore.get(WORKSPACE_COOKIE)?.value)
  return { userId: user.id, current, memberships }
})

/** The workspace id every read/write should be scoped to. Throws if there isn't one. */
export async function requireWorkspaceId(): Promise<string> {
  const ctx = await getWorkspaceContext()
  if (!ctx) throw new Error('No workspace available for this user.')
  return ctx.current.workspace.id
}

export function hasPermission(membership: WorkspaceMembership, permission: string): boolean {
  return membership.permissions[permission] === true
}

/** Treasurer in the currently selected workspace. */
export async function isCurrentTreasurer(): Promise<boolean> {
  const ctx = await getWorkspaceContext()
  return !!ctx && hasPermission(ctx.current, 'treasurer')
}

/** Permission check against a specific workspace's membership row (for rows that carry their own workspace_id). */
export async function hasWorkspacePermission(userId: string, workspaceId: string, permission: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('workspace_members')
    .select('permissions')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle()
  return !!data && normalisePermissions(data.permissions)[permission] === true
}
