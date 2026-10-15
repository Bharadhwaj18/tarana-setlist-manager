import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCachedUser } from '@/lib/data'
import { SetupForm } from './SetupForm'

export default async function SetupPage() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await getCachedUser()

  let effectiveUser = user
  if (!user && userError) {
    const { data: { session } } = await supabase.auth.getSession()
    effectiveUser = session?.user ?? null
  }

  if (!effectiveUser) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', effectiveUser.id)
    .maybeSingle()

  // Only skip setup if we got a successful response confirming name is set
  if (!profileError && profile?.display_name?.trim()) redirect('/')

  // Prefill the name given on the sign-up form, if any.
  const suggested = typeof effectiveUser.user_metadata?.display_name === 'string' ? effectiveUser.user_metadata.display_name : ''
  return <SetupForm email={effectiveUser.email ?? ''} suggestedName={suggested} />
}
