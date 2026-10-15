import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCachedUser, getCachedPendingPayments, getCachedNotifications, getCachedAllProfiles } from '@/lib/data'
import { resolveNotificationItems } from '@/lib/notifications'
import { getWorkspaceOptions } from '@/lib/workspace-options-server'
import { Sidebar } from '@/components/layout/Sidebar'
import { OfflineUserSync } from '@/components/OfflineUserSync'
import { IdentifyUser } from '@/components/analytics/IdentifyUser'
import type { ReactNode } from 'react'
import { hiddenSectionsOf } from '@/lib/workspace-sections'
import { getWorkspaceContext } from '@/lib/workspace'
import { headers } from 'next/headers'
import { sectionForHref, sectionLabelOf } from '@/lib/workspace-sections'
import { NoAccess } from '@/components/layout/NoAccess'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()

  // getUser() calls Supabase's API to verify the token.
  // When offline it returns null + an error — fall back to getSession()
  // which reads the JWT from the cookie locally without any network call.
  const { data: { user }, error: userError } = await getCachedUser()

  let effectiveUser = user
  if (!user && userError) {
    const { data: { session } } = await supabase.auth.getSession()
    effectiveUser = session?.user ?? null
  }

  if (!effectiveUser) redirect('/login')

  // Everything the shell needs is independent of everything else, so fetch it in ONE round
  // trip instead of a chain of awaits (each await used to add a full database latency).
  const [{ data: profile, error: profileError }, pendingPayments, notifications, profiles, { options: workspaceOptions, currentId: currentWorkspaceId }] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', effectiveUser.id).maybeSingle(),
    getCachedPendingPayments(),
    getCachedNotifications(effectiveUser.id, 40),
    getCachedAllProfiles(),
    getWorkspaceOptions(),
  ])

  // Skip the setup redirect when offline (if the profile query errors, the user has already done setup before)
  if (!profileError && !profile?.display_name?.trim()) redirect('/setup')

  // How many split payments this person still owes a bandmate: the Sidebar's Finance badge.
  const pendingCount = pendingPayments.filter(p => p.from_member === effectiveUser.id).length
  const notificationItems = resolveNotificationItems(notifications, profiles, effectiveUser.id)

  const ctx = await getWorkspaceContext()
  const hiddenSections = ctx ? hiddenSectionsOf(ctx.current.sections) : []
  const pathname = (await headers()).get('x-pathname') ?? ''
  const blockedSection = sectionForHref(pathname)
  const blocked = !!ctx && !!blockedSection && ctx.current.sections[blockedSection] === 'none'
  const sectionLabel = blockedSection ? sectionLabelOf(blockedSection) : ''

  return (
    <div className="flex h-screen">
      <OfflineUserSync email={effectiveUser.email ?? ''} displayName={profile?.display_name ?? ''} />
      <IdentifyUser userId={effectiveUser.id} email={effectiveUser.email} name={profile?.display_name} />
      <Sidebar user={effectiveUser} pendingPaymentCount={pendingCount} notifications={notificationItems}
        workspaces={workspaceOptions}
        currentWorkspaceId={currentWorkspaceId} hiddenSections={hiddenSections} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 pb-28 pt-16 sm:px-6 lg:px-8 lg:pb-8 lg:pt-8">
          {blocked ? <NoAccess section={sectionLabel} workspaceName={ctx?.current.workspace.name ?? 'this workspace'} /> : children}
        </div>
      </main>
    </div>
  )
}
