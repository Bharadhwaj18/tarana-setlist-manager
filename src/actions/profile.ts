'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function saveDisplayName(name: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const trimmed = name.trim()
  if (!trimmed) throw new Error('Display name is required')
  if (trimmed.length > 40) throw new Error('Display name must be 40 characters or fewer')

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, display_name: trimmed })

  if (error) throw new Error(error.message)

  revalidatePath('/', 'layout')
  redirect('/setlists')
}
