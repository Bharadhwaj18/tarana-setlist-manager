'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { sendPushToProfile } from '@/lib/push'

export interface PushSubscriptionData {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export async function subscribeToPush(subscription: PushSubscriptionData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      profile_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    { onConflict: 'endpoint' }
  )
  if (error) return { error: error.message }
  return {}
}

export async function unsubscribeFromPush(endpoint: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) return { error: error.message }
  return {}
}

interface SendNotificationInput {
  recipientId: string
  title: string
  body?: string | null
  link?: string | null
  type?: string
}

/**
 * Writes the notifications row (the source of truth for the in-app bell)
 * then best-effort pushes to the recipient's devices — a push failure
 * never fails this action, since the DB row already did the job of
 * recording the notification even if nobody's subscribed on any device.
 */
export async function sendNotification({ recipientId, title, body, link, type }: SendNotificationInput): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase.from('notifications').insert({
    recipient_id: recipientId,
    sender_id: user.id,
    title,
    body: body ?? null,
    link: link ?? null,
    type: type ?? 'custom',
  })
  if (error) return { error: error.message }

  try {
    await sendPushToProfile(supabase, recipientId, { title, body, link })
  } catch {
    // Push is a bonus on top of the in-app notification — never fail the
    // action just because a push send hiccupped.
  }

  revalidatePath('/', 'layout')
  return {}
}

export async function markNotificationRead(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return {}
}

export async function markAllNotificationsRead(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', user.id)
    .is('read_at', null)
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return {}
}
