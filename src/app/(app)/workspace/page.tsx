import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { getCachedAllProfiles } from '@/lib/data'
import { normalisePermissions } from '@/lib/workspace-shared'
import { WorkspaceManager, type MemberRow, type InviteRow } from '@/components/workspace/WorkspaceManager'
import { Button } from '@/components/ui/Button'

export default async function WorkspacePage() {
  const ctx = await getWorkspaceContext()
  if (!ctx) return null
  const { workspace, role } = ctx.current

  if (workspace.type === 'personal') {
    return (
      <div className="max-w-xl">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Personal space</h1>
        <p className="mb-6 text-sm text-gray-500">
          This space is just for you. To work with others, create a workspace and invite them with a link.
        </p>
        <Button asChild><Link href="/workspace/new">Create a workspace</Link></Button>
      </div>
    )
  }

  const isAdmin = role === 'owner' || role === 'admin'
  const supabase = await createClient()

  const [{ data: memberRows }, profiles, { data: inviteRows }] = await Promise.all([
    supabase.from('workspace_members').select('user_id, role, permissions, created_at').eq('workspace_id', workspace.id).order('created_at'),
    getCachedAllProfiles(),
    isAdmin
      ? supabase
          .from('workspace_invites')
          .select('id, token, role, expires_at, max_uses, use_count')
          .eq('workspace_id', workspace.id)
          .is('revoked_at', null)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])

  const members: MemberRow[] = (memberRows ?? []).map(m => ({
    userId: m.user_id,
    name: profiles.find(p => p.id === m.user_id)?.display_name?.trim() || 'Unnamed member',
    role: m.role,
    treasurer: normalisePermissions(m.permissions).treasurer === true,
    isYou: m.user_id === ctx.userId,
  }))

  const invites: InviteRow[] = (inviteRows ?? [])
    .filter(i => i.max_uses === null || i.use_count < i.max_uses)
    .map(i => ({ id: i.id, token: i.token, role: i.role, expiresAt: i.expires_at, maxUses: i.max_uses, useCount: i.use_count }))

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">{workspace.name}</h1>
      <WorkspaceManager
        workspaceName={workspace.name}
        isAdmin={isAdmin}
        isOwner={role === 'owner'}
        members={members}
        invites={invites}
      />
    </div>
  )
}
