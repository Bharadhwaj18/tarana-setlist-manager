import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { PENDING_INVITE_COOKIE, WORKSPACE_CHOSEN_COOKIE } from '@/lib/workspace-shared'
import { createClient } from '@/lib/supabase/server'
import { getCachedUser, getCachedPendingPayments, getCachedNotifications, getCachedAllProfiles, getCachedFinanceSettings } from '@/lib/data'
import { FinanceSettingsProvider } from '@/components/finance/FinanceSettingsContext'
import { resolveNotificationItems } from '@/lib/notifications'
import { getWorkspaceOptions } from '@/lib/workspace-options-server'
import { Sidebar } from '@/components/layout/Sidebar'
import { OfflineUserSync } from '@/components/OfflineUserSync'
import { IdentifyUser } from '@/components/analytics/IdentifyUser'
import type { ReactNode } from 'react'
import { hiddenSectionsOf } from '@/lib/workspace-sections'
import { getWorkspaceContext, isFinanceApprover } from '@/lib/workspace'
import { PageFade } from '@/components/layout/PageFade'

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

  // Opened an invite but haven't joined yet (e.g. signed up in another tab or browser)? Take them back to it.
  const pendingInvite = (await cookies()).get(PENDING_INVITE_COOKIE)?.value
  if (pendingInvite) {
    const { data: preview } = await supabase.rpc('invite_preview', { p_token: pendingInvite })
    if (preview?.[0]?.state === 'valid') redirect(`/invite/${pendingInvite}`)
  }

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

  // Coming in fresh with more than one workspace? Pick one first, then carry on to where they were going.
  // Creating a workspace is one of the picker's own choices, so that page never bounces back to it.
  const path = (await headers()).get('x-pathname') ?? '/'
  if (workspaceOptions.length > 1 && !path.startsWith('/workspace/new') && !(await cookies()).get(WORKSPACE_CHOSEN_COOKIE)) {
    redirect(path === '/' ? '/choose-workspace' : `/choose-workspace?next=${encodeURIComponent(path)}`)
  }

  // How many split payments this person still owes a bandmate: the Sidebar's Finance badge.
  const pendingCount = pendingPayments.filter(p => p.from_member === effectiveUser.id).length
  const notificationItems = resolveNotificationItems(notifications, profiles, effectiveUser.id)

  const ctx = await getWorkspaceContext()
  const hiddenSections = ctx ? hiddenSectionsOf(ctx.current.sections) : []
  const financeSettings = await getCachedFinanceSettings()

  return (
    <div className="flex h-screen">
      <OfflineUserSync email={effectiveUser.email ?? ''} displayName={profile?.display_name ?? ''} />
      <IdentifyUser userId={effectiveUser.id} email={effectiveUser.email} name={profile?.display_name} />
      <Sidebar user={effectiveUser} pendingPaymentCount={pendingCount} notifications={notificationItems}
        workspaces={workspaceOptions}
        currentWorkspaceId={currentWorkspaceId} hiddenSections={hiddenSections} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 pb-28 pt-16 sm:px-6 lg:px-8 lg:pb-8 lg:pt-8">
          <FinanceSettingsProvider settings={financeSettings} canApprove={!!ctx && isFinanceApprover(ctx.current)}><PageFade>{children}</PageFade></FinanceSettingsProvider>
        </div>
      </main>
    </div>
  )
}
