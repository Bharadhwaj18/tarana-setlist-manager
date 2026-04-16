import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SetupForm } from './SetupForm'

export default async function SetupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // If display name already set, skip setup
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  if (profile?.display_name?.trim()) redirect('/setlists')

  return <SetupForm email={user.email ?? ''} />
}
