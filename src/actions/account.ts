'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { planAccountDeletion, DELETE_CONFIRMATION } from '@/lib/account-deletion'
import { WORKSPACE_COOKIE } from '@/lib/workspace-shared'

/**
 * In-app account deletion (required by both the App Store and Google Play).
 *
 * Shared band history stays intact for the remaining members: finance rows,
 * setlists and songs that point at this person keep their foreign keys, the
 * profile is kept but anonymised, and the auth user is soft-deleted (Supabase
 * scrubs the identity and the login can never be used again). What goes:
 * workspaces only this person was in, their memberships, push subscriptions
 * and inbox.
 *
 * Owning a band other people still use blocks deletion — ownership has to
 * move to someone else first, or the band would be left without an owner.
 */
export async function deleteAccount(confirmation: string): Promise<{ error?: string }> {
  if (confirmation.trim() !== DELETE_CONFIRMATION) return { error: `Type ${DELETE_CONFIRMATION} to confirm.` }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Everything below acts on another user's rows too (memberships of shared
  // workspaces, the auth user itself), which RLS rightly won't allow the
  // user's own client to do — the identity check above is the gate.
  const admin = createServiceClient()

  const { data: owned, error: ownedError } = await admin
    .from('workspaces')
    .select('id, name, type')
    .eq('owner_id', user.id)
  if (ownedError) return { error: ownedError.message }

  const ownedIds = (owned ?? []).map(w => w.id)
  const { data: memberRows, error: membersError } = ownedIds.length
    ? await admin.from('workspace_members').select('workspace_id').in('workspace_id', ownedIds)
    : { data: [], error: null }
  if (membersError) return { error: membersError.message }

  const plan = planAccountDeletion((owned ?? []).map(w => ({
    ...w,
    memberCount: (memberRows ?? []).filter(m => m.workspace_id === w.id).length,
  })))
  if (plan.blockedBy.length) {
    return { error: `You own ${plan.blockedBy.join(', ')}. Make someone else the owner, or remove its other members, before deleting your account.` }
  }

  if (plan.deleteWorkspaceIds.length) {
    const { error } = await admin.from('workspaces').delete().in('id', plan.deleteWorkspaceIds)
    if (error) return { error: `Couldn't delete your workspaces: ${error.message}` }
  }

  const cleanups = await Promise.all([
    admin.from('workspace_members').delete().eq('user_id', user.id),
    admin.from('push_subscriptions').delete().eq('profile_id', user.id),
    admin.from('notifications').delete().eq('recipient_id', user.id),
    admin.from('profiles').update({ display_name: 'Deleted user' }).eq('id', user.id),
  ])
  const cleanupError = cleanups.find(r => r.error)?.error
  if (cleanupError) return { error: cleanupError.message }

  const { error: authError } = await admin.auth.admin.deleteUser(user.id, true)
  if (authError) return { error: authError.message }

  await supabase.auth.signOut()
  const cookieStore = await cookies()
  cookieStore.delete(WORKSPACE_COOKIE)
  redirect('/login?deleted=1')
}
