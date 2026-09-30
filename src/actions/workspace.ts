'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { WORKSPACE_COOKIE, normalisePermissions } from '@/lib/workspace-shared'

async function selectWorkspace(workspaceId: string) {
  const cookieStore = await cookies()
  cookieStore.set(WORKSPACE_COOKIE, workspaceId, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  revalidatePath('/', 'layout')
}

/** The current workspace, only if the caller is an owner/admin of it. */
async function requireAdminContext() {
  const ctx = await getWorkspaceContext()
  if (!ctx) return { error: 'Not authenticated' as const }
  const { workspace, role } = ctx.current
  if (workspace.type === 'personal') return { error: 'This is your personal space, it has no members to manage.' as const }
  if (role !== 'owner' && role !== 'admin') return { error: 'Only a workspace admin can do that.' as const }
  return { ctx, workspaceId: workspace.id }
}

export async function switchWorkspace(workspaceId: string): Promise<{ error?: string }> {
  const ctx = await getWorkspaceContext()
  if (!ctx) return { error: 'Not authenticated' }
  if (!ctx.memberships.some(m => m.workspace.id === workspaceId)) return { error: 'You’re not a member of that workspace.' }

  await selectWorkspace(workspaceId)
  return {}
}

export async function createWorkspace(name: string): Promise<{ error?: string; id?: string }> {
  name = name.trim()
  if (name.length < 1 || name.length > 80) return { error: 'Workspace name must be 1–80 characters.' }
  const ctx = await getWorkspaceContext()
  if (!ctx) return { error: 'Not authenticated' }
  if (ctx.memberships.length >= 25) return { error: 'You have reached the workspace limit.' }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_workspace', { p_name: name, p_type: 'band' })
  if (error) return { error: error.message }
  await selectWorkspace(data)
  return { id: data }
}

export async function renameWorkspace(name: string): Promise<{ error?: string }> {
  name = name.trim()
  if (name.length < 1 || name.length > 80) return { error: 'Workspace name must be 1–80 characters.' }
  const auth = await requireAdminContext()
  if ('error' in auth) return { error: auth.error }
  const supabase = await createClient()
  const { error } = await supabase.rpc('rename_workspace', { p_ws: auth.workspaceId, p_name: name })
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return {}
}

export interface CreateInviteInput {
  role: 'member' | 'admin'
  expiresInDays: number
  maxUses: number | null
}

export async function createInvite(input: CreateInviteInput): Promise<{ error?: string; token?: string }> {
  const auth = await requireAdminContext()
  if ('error' in auth) return { error: auth.error }
  if (!Number.isInteger(input.expiresInDays) || input.expiresInDays < 1 || input.expiresInDays > 30) {
    return { error: 'Expiry must be between 1 and 30 days.' }
  }
  if (input.maxUses !== null && (!Number.isInteger(input.maxUses) || input.maxUses < 1)) {
    return { error: 'Max uses must be at least 1.' }
  }
  const supabase = await createClient()

  // Simple abuse guard, no external store needed: cap invites minted per workspace per hour.
  const { count: recent } = await supabase
    .from('workspace_invites')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', auth.workspaceId)
    .gte('created_at', new Date(Date.now() - 3_600_000).toISOString())
  if ((recent ?? 0) >= 20) return { error: 'Too many invite links created recently. Try again in an hour.' }

  const { data, error } = await supabase
    .from('workspace_invites')
    .insert({
      workspace_id: auth.workspaceId,
      role: input.role,
      max_uses: input.maxUses,
      expires_at: new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString(),
    })
    .select('token')
    .single()
  if (error) return { error: error.message }
  revalidatePath('/workspace')
  return { token: data.token }
}

export async function revokeInvite(inviteId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('revoke_workspace_invite', { p_invite: inviteId })
  if (error) return { error: error.message }
  revalidatePath('/workspace')
  return {}
}

export async function acceptInvite(token: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('accept_workspace_invite', { p_token: token })
  if (error) return { error: error.message }
  await selectWorkspace(data)
  return {}
}

export async function setMemberTreasurer(userId: string, isTreasurer: boolean): Promise<{ error?: string }> {
  const auth = await requireAdminContext()
  if ('error' in auth) return { error: auth.error }
  const supabase = await createClient()
  const { data: member } = await supabase
    .from('workspace_members')
    .select('permissions, role')
    .eq('workspace_id', auth.workspaceId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!member) return { error: 'Member not found.' }
  const permissions = { ...normalisePermissions(member.permissions), treasurer: isTreasurer }
  const { error } = await supabase
    .from('workspace_members')
    .update({ permissions })
    .eq('workspace_id', auth.workspaceId)
    .eq('user_id', userId)
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return {}
}

export async function setMemberRole(userId: string, role: 'admin' | 'member'): Promise<{ error?: string }> {
  const auth = await requireAdminContext()
  if ('error' in auth) return { error: auth.error }
  const supabase = await createClient()
  const { error } = await supabase
    .from('workspace_members')
    .update({ role })
    .eq('workspace_id', auth.workspaceId)
    .eq('user_id', userId)
  if (error) return { error: error.message }
  revalidatePath('/workspace')
  return {}
}

export async function removeMember(userId: string): Promise<{ error?: string }> {
  const auth = await requireAdminContext()
  if ('error' in auth) return { error: auth.error }
  if (userId === auth.ctx.userId) return { error: 'Use “Leave workspace” to remove yourself.' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', auth.workspaceId)
    .eq('user_id', userId)
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return {}
}

export async function leaveWorkspace(): Promise<{ error?: string }> {
  const ctx = await getWorkspaceContext()
  if (!ctx) return { error: 'Not authenticated' }
  const { workspace, role } = ctx.current
  if (workspace.type === 'personal') return { error: 'You can’t leave your personal space.' }
  if (role === 'owner') return { error: 'The owner can’t leave their own workspace.' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspace.id)
    .eq('user_id', ctx.userId)
  if (error) return { error: error.message }
  const cookieStore = await cookies()
  cookieStore.delete(WORKSPACE_COOKIE)
  revalidatePath('/', 'layout')
  return {}
}
