import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { getCachedAllProfiles, getCachedProfileAvatars, getCachedUser } from '@/lib/data'
import { normalisePermissions } from '@/lib/workspace-shared'
import { sectionLevelsFrom } from '@/lib/workspace-sections'
import type { InviteRow, MemberRow, WorkspaceSummary } from '@/components/workspace/settings-types'

/** Who is looking at Settings, and which workspace's settings they're seeing. Shared by the layout and every page. */
export const getSettingsContext = cache(async () => {
  const [ctx, { data: { user } }] = await Promise.all([getWorkspaceContext(), getCachedUser()])
  if (!ctx || !user) redirect('/login')
  const { workspace, role } = ctx.current
  const isOwner = role === 'owner'
  const isAdmin = isOwner || role === 'admin'
  const isPersonal = workspace.type === 'personal'

  const [profiles, avatars] = await Promise.all([getCachedAllProfiles(), getCachedProfileAvatars()])
  const supabase = await createClient()
  const { data: me } = await supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle()

  const summary: WorkspaceSummary = {
    id: workspace.id,
    name: workspace.name,
    kind: workspace.kind ?? null,
    description: workspace.description ?? null,
    color: workspace.color,
    avatarUrl: workspace.avatar_url ?? null,
  }

  return {
    userId: user.id,
    email: user.email ?? '',
    name: me?.display_name?.trim() || profiles.find(p => p.id === user.id)?.display_name?.trim() || '',
    avatarUrl: avatars[user.id] ?? null,
    workspace: summary,
    isPersonal,
    isOwner,
    isAdmin,
  }
})

/** Everyone in the current workspace. What each person can open is only filled in for admins. */
export const getSettingsMembers = cache(async (): Promise<MemberRow[]> => {
  const s = await getSettingsContext()
  const supabase = await createClient()
  const [{ data: rows }, profiles, avatars] = await Promise.all([
    supabase.from('workspace_members').select('user_id, role, permissions, created_at').eq('workspace_id', s.workspace.id).order('created_at'),
    getCachedAllProfiles(),
    getCachedProfileAvatars(),
  ])
  return (rows ?? []).map(m => ({
    userId: m.user_id,
    name: profiles.find(p => p.id === m.user_id)?.display_name?.trim() || 'Unnamed member',
    role: m.role,
    treasurer: normalisePermissions(m.permissions).treasurer === true,
    sections: sectionLevelsFrom(s.isAdmin ? m.permissions : null, m.role),
    isYou: m.user_id === s.userId,
    avatarUrl: avatars[m.user_id] ?? null,
  }))
})

/** Invite links still working in the current workspace. Admins only; everyone else gets none. */
export const getSettingsInvites = cache(async (): Promise<InviteRow[]> => {
  const s = await getSettingsContext()
  if (!s.isAdmin || s.isPersonal) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('workspace_invites')
    .select('id, token, role, permissions, expires_at, max_uses, use_count')
    .eq('workspace_id', s.workspace.id)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
  return (data ?? [])
    .filter(i => i.max_uses === null || i.use_count < i.max_uses)
    .map(i => ({
      id: i.id, token: i.token, role: i.role, expiresAt: i.expires_at, maxUses: i.max_uses, useCount: i.use_count,
      sections: i.permissions && typeof i.permissions === 'object' && !Array.isArray(i.permissions) && 'sections' in i.permissions ? sectionLevelsFrom(i.permissions, 'member') : null,
    }))
})

/** Tags already on entries in the current workspace, so Money settings can list and rename them. */
export async function getUsedTags(workspaceId: string) {
  const supabase = await createClient()
  const { data } = await supabase.from('finance_transactions').select('tags').eq('workspace_id', workspaceId)
  return [...new Set((data ?? []).flatMap(r => r.tags ?? []))]
}
