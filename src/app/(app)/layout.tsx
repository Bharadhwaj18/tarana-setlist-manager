import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCachedUser, getCachedPendingPayments, getCachedNotifications, getCachedAllProfiles } from '@/lib/data'
import { resolveNotificationItems } from '@/lib/notifications'
import { Sidebar } from '@/components/layout/Sidebar'
import { OfflineUserSync } from '@/components/OfflineUserSync'
import { IdentifyUser } from '@/components/analytics/IdentifyUser'
import type { ReactNode } from 'react'

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

  // Check display name — but skip the setup redirect when offline
  // (if the profile query errors, the user has already done setup before)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', effectiveUser.id)
    .maybeSingle()

  if (!profileError && !profile?.display_name?.trim()) redirect('/setup')

  // How many split payments this person still owes a bandmate — the
  // Sidebar's Finance badge, visible from anywhere in the app until each
  // one's marked paid.
  const pendingPayments = await getCachedPendingPayments()
  const pendingCount = pendingPayments.filter(p => p.from_member === effectiveUser.id).length

  const [notifications, profiles] = await Promise.all([
    getCachedNotifications(effectiveUser.id),
    getCachedAllProfiles(),
  ])
  const notificationItems = resolveNotificationItems(notifications, profiles, effectiveUser.id)

  return (
    <div className="flex h-screen">
      <OfflineUserSync email={effectiveUser.email ?? ''} displayName={profile?.display_name ?? ''} />
      <IdentifyUser userId={effectiveUser.id} email={effectiveUser.email} name={profile?.display_name} />
      <Sidebar user={effectiveUser} pendingPaymentCount={pendingCount} notifications={notificationItems} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 pb-8 pt-20 sm:px-6 lg:px-8 lg:pt-8">
          {children}
        </div>
      </main>
    </div>
  )
}
