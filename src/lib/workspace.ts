import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getCachedUser } from '@/lib/auth-cache'
import { WORKSPACE_COOKIE, pickCurrentWorkspace, normalisePermissions } from '@/lib/workspace-shared'
import type { WorkspaceContext, WorkspaceMembership } from '@/types/workspace'
import { hiddenSectionsOf, sectionLevelsFrom, type SectionKey } from '@/lib/workspace-sections'

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
      return workspace
        ? { workspace, role: m.role, permissions: normalisePermissions(m.permissions), sections: sectionLevelsFrom(m.permissions, m.role) }
        : null
    })
    .filter((m): m is WorkspaceMembership => m !== null)
  if (!memberships.length) return null

  const cookieStore = await cookies()
  // The phone app names its workspace in a header; it's checked against your memberships like the cookie is.
  const wanted = (await headers()).get('x-workspace-id') ?? cookieStore.get(WORKSPACE_COOKIE)?.value
  const current = pickCurrentWorkspace(memberships, wanted)
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

/** Can approve finance entries (and change them while approval is on): owners, admins and treasurers. */
export function isFinanceApprover(membership: WorkspaceMembership): boolean {
  return membership.role === 'owner' || membership.role === 'admin' || hasPermission(membership, 'treasurer')
}

/** Can approve merch takings into Finance: owners, admins and members given the Merch role. */
export function isMerchApprover(membership: WorkspaceMembership): boolean {
  return membership.role === 'owner' || membership.role === 'admin' || hasPermission(membership, 'merch_manager')
}

export type MerchScope = 'full' | 'crew' | 'none'

/**
 * What of Merch this member sees. Mirrors merch_scope() in the database:
 * 'full' for owners, admins, the Merch role and anyone whose Merch section isn't hidden;
 * 'crew' for Merch crew (only their own show kits); 'none' otherwise.
 */
export function merchScopeOf(membership: WorkspaceMembership): MerchScope {
  if (isMerchApprover(membership)) return 'full'
  if (hasPermission(membership, 'merch_crew')) return 'crew'
  return membership.sections.merch === 'none' ? 'none' : 'full'
}

/** Sections hidden from the nav. Merch crew still get the Merch link (it opens their kits). */
export function navHiddenSections(membership: WorkspaceMembership): SectionKey[] {
  const hidden = hiddenSectionsOf(membership.sections)
  return merchScopeOf(membership) === 'crew' ? hidden.filter(k => k !== 'merch') : hidden
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
