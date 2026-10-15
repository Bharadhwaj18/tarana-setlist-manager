'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function saveDisplayName(name: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const trimmed = name.trim()
  if (!trimmed) return { error: 'Display name is required' }
  if (trimmed.length > 40) return { error: 'Display name must be 40 characters or fewer' }

  // Try UPDATE first (profile row should exist from auth trigger)
  const { error: updateError, data: updated } = await supabase
    .from('profiles')
    .update({ display_name: trimmed })
    .eq('id', user.id)
    .select('id')

  if (updateError) return { error: updateError.message }

  // If no row was updated, the trigger didn't create the profile — INSERT it
  if (!updated || updated.length === 0) {
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({ id: user.id, display_name: trimmed })

    if (insertError) return { error: insertError.message }
  }

  revalidatePath('/', 'layout')
  return {}
}

/** Sets (or, with null, removes) your photo after it has been uploaded to the profile-avatars bucket. */
export async function setProfileAvatar(url: string | null): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (url !== null && (url.length > 500 || !/^https?:\/\//.test(url))) return { error: 'That photo address isn’t valid.' }

  const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id)
  if (error) {
    return { error: /avatar_url/.test(error.message) ? 'Profile photos aren’t switched on yet. Run the profile photos SQL first.' : error.message }
  }
  revalidatePath('/', 'layout')
  return {}
}
