'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendNotification } from '@/actions/notifications'
import { DOCUMENT_BUCKET } from '@/types/show-document'
import { getWorkspaceContext } from '@/lib/workspace'
import { PENDING_INVITE_COOKIE, WORKSPACE_COOKIE } from '@/lib/workspace-shared'
import { SECTIONS, type SectionLevel, type SectionKey } from '@/lib/workspace-sections'
import { createWorkspaceInputSchema, updateWorkspaceDetailsSchema, type CreateWorkspaceInput, type UpdateWorkspaceDetailsInput } from '@/lib/validators'

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

/** Accepts just a name (older callers) or the full form: name, optional kind and avatar colour. */
export async function createWorkspace(input: string | CreateWorkspaceInput): Promise<{ error?: string; id?: string }> {
  const parsed = createWorkspaceInputSchema.safeParse(typeof input === 'string' ? { name: input } : input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_workspace', {
    p_name: parsed.data.name,
    p_type: 'band',
    p_kind: parsed.data.kind || null,
    p_color: parsed.data.color ?? 'forest',
  })
  if (error) return { error: error.message }
  await selectWorkspace(data)
  return { id: data }
}

export async function renameWorkspace(name: string): Promise<{ error?: string }> {
  const auth = await requireAdminContext()
  if ('error' in auth) return { error: auth.error }
  const supabase = await createClient()
  const { error } = await supabase.rpc('rename_workspace', { p_ws: auth.workspaceId, p_name: name })
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return {}
}

/** Name, kind, description, colour and logo/photo of the current workspace. Omitted fields stay as they are; avatarUrl null removes the image. */
export async function updateWorkspaceDetails(input: UpdateWorkspaceDetailsInput): Promise<{ error?: string }> {
  const auth = await requireAdminContext()
  if ('error' in auth) return { error: auth.error }
  const parsed = updateWorkspaceDetailsSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const d = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.rpc('update_workspace_details', {
    p_ws: auth.workspaceId,
    p_name: d.name ?? null,
    p_kind: d.kind ?? null,
    p_description: d.description ?? null,
    p_color: d.color ?? null,
    p_avatar_url: typeof d.avatarUrl === 'string' ? d.avatarUrl : null,
    p_clear_avatar: d.avatarUrl === null,
  })
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return {}
}

/** Sets (or, with null, removes) the logo/photo after the image has been uploaded to the workspace-avatars bucket. */
export async function setWorkspaceAvatar(publicUrl: string | null): Promise<{ error?: string }> {
  return updateWorkspaceDetails({ avatarUrl: publicUrl })
}

/** Hands the workspace to another member; the current owner becomes an admin. Owner only. */
export async function transferOwnership(userId: string): Promise<{ error?: string }> {
  const auth = await requireAdminContext()
  if ('error' in auth) return { error: auth.error }
  if (auth.ctx.current.role !== 'owner') return { error: 'Only the owner can transfer this workspace.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('transfer_workspace_ownership', { p_ws: auth.workspaceId, p_new_owner: userId })
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return {}
}

export interface CreateInviteInput {
  role: 'member' | 'admin'
  expiresInDays: number
  maxUses: number | null
  /** What a member who joins with this link can open. Ignored for admins, who always get everything. */
  sections?: Partial<Record<SectionKey, SectionLevel>>
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
  const allowed = new Set<string>(SECTIONS.map(s => s.key))
  const sections = input.role === 'member' && input.sections
    ? Object.fromEntries(Object.entries(input.sections).filter(([k, v]) => allowed.has(k) && (v === 'edit' || v === 'view' || v === 'none')))
    : null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('workspace_invites')
    .insert({
      workspace_id: auth.workspaceId,
      role: input.role,
      permissions: sections ? { sections } : {},
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

/** "Not now" on an invite: stop sending this person back to it. */
export async function dismissPendingInvite(): Promise<void> {
  ;(await cookies()).delete(PENDING_INVITE_COOKIE)
}

export async function acceptInvite(token: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  // join_with_invite also applies the access chosen on the invite. Until its SQL has been run, fall back to the plain join.
  let { data, error } = await supabase.rpc('join_with_invite', { p_token: token })
  if (error?.code === 'PGRST202') ({ data, error } = await supabase.rpc('accept_workspace_invite', { p_token: token }))
  if (error || !data) return { error: error?.message ?? 'Couldn’t join this workspace.' }
  ;(await cookies()).delete(PENDING_INVITE_COOKIE)
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
  const raw = member.permissions && typeof member.permissions === 'object' && !Array.isArray(member.permissions) ? member.permissions : {}
  const permissions = { ...raw, treasurer: isTreasurer }
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

/**
 * Permanently deletes the current workspace and everything in it. Owner/admin only, never a
 * personal space, and the caller must type the workspace's exact name.
 */
export async function deleteWorkspace(confirmName: string): Promise<{ error?: string }> {
  const auth = await requireAdminContext()
  if ('error' in auth) return { error: auth.error }
  const { workspace } = auth.ctx.current
  if (confirmName.trim() !== workspace.name) return { error: 'Type the workspace name exactly to confirm.' }

  const supabase = await createClient()
  const [{ data: recordings }, { data: documents }, { data: members }] = await Promise.all([
    supabase.from('recordings').select('file_path').eq('workspace_id', workspace.id),
    supabase.from('show_documents').select('file_path').eq('workspace_id', workspace.id),
    supabase.from('workspace_members').select('user_id').eq('workspace_id', workspace.id),
  ])

  const { error } = await supabase.rpc('delete_workspace', { p_ws: workspace.id })
  if (error) return { error: error.message }

  // Uploaded files live in storage, not in the tables that just cascaded away. Best effort:
  // the workspace is already gone, so a failure here only leaves orphaned files behind.
  try {
    const storage = createServiceClient().storage
    const recordingPaths = (recordings ?? []).map(r => r.file_path)
    const documentPaths = (documents ?? []).map(d => d.file_path)
    if (recordingPaths.length) await storage.from('recordings').remove(recordingPaths)
    if (documentPaths.length) await storage.from(DOCUMENT_BUCKET).remove(documentPaths)
  } catch {}

  const cookieStore = await cookies()
  cookieStore.delete(WORKSPACE_COOKIE)

  const others = (members ?? []).map(m => m.user_id).filter(id => id !== auth.ctx.userId)
  await Promise.all(others.map(recipientId => sendNotification({
    recipientId,
    title: `"${workspace.name}" was deleted`,
    body: 'An admin deleted this workspace.',
    link: '/',
    type: 'workspace_deleted',
  })))

  revalidatePath('/', 'layout')
  return {}
}

/** Sets what sections a member can see (none / view / edit). Owners and admins can't be restricted. */
export async function setMemberSections(userId: string, levels: Partial<Record<SectionKey, SectionLevel>>): Promise<{ error?: string }> {
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
  if (member.role === 'owner' || member.role === 'admin') return { error: 'Owners and admins always have access to everything.' }

  const raw = member.permissions && typeof member.permissions === 'object' && !Array.isArray(member.permissions) ? (member.permissions as Record<string, unknown>) : {}
  const current = raw.sections && typeof raw.sections === 'object' && !Array.isArray(raw.sections) ? (raw.sections as Record<string, string>) : {}
  const allowed = new Set<string>(SECTIONS.map(s => s.key))
  const next: Record<string, string> = { ...current }
  for (const [key, level] of Object.entries(levels)) {
    if (allowed.has(key) && (level === 'edit' || level === 'view' || level === 'none')) next[key] = level
  }
  const { error } = await supabase
    .from('workspace_members')
    .update({ permissions: { ...raw, sections: next } })
    .eq('workspace_id', auth.workspaceId)
    .eq('user_id', userId)
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return {}
}
