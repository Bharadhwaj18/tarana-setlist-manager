import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SetupForm } from './SetupForm'

export default async function SetupPage() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

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
  if (!profileError && profile?.display_name?.trim()) redirect('/setlists')

  return <SetupForm email={effectiveUser.email ?? ''} />
}
