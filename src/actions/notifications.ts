'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { sendPushToProfile } from '@/lib/push'
import { getWorkspaceContext } from '@/lib/workspace'
import { chooseWorkspace } from '@/lib/workspace-cookies'

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

  const ctx = await getWorkspaceContext()
  const { error } = await supabase.from('notifications').insert({
    recipient_id: recipientId,
    sender_id: user.id,
    workspace_id: ctx?.current.workspace.id ?? null,
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

interface SendNotificationToAllInput {
  title: string
  body?: string | null
  link?: string | null
  type?: string
}

/**
 * One notifications row (and one push) per other band member — not a
 * single row with no recipient, since every recipient needs their own
 * read_at state and their own row to mark read independently.
 */
export async function sendNotificationToAll({ title, body, link, type }: SendNotificationToAllInput): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Only the current workspace's other members — never the whole user base.
  const ctx = await getWorkspaceContext()
  if (!ctx) return {}
  const { data: members, error: profilesError } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', ctx.current.workspace.id)
    .neq('user_id', user.id)
  if (profilesError) return { error: profilesError.message }
  const profiles = (members ?? []).map(m => ({ id: m.user_id }))
  if (!profiles?.length) return {}

  const { error } = await supabase.from('notifications').insert(
    profiles.map(p => ({
      recipient_id: p.id,
      sender_id: user.id,
      workspace_id: ctx.current.workspace.id,
      title,
      body: body ?? null,
      link: link ?? null,
      type: type ?? 'custom',
    }))
  )
  if (error) return { error: error.message }

  await Promise.allSettled(
    profiles.map(p => sendPushToProfile(supabase, p.id, { title, body, link }))
  )

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

/** The workspace an entity link points at (a show, setlist or task), for notifications saved before they had one. */
async function workspaceOfLink(supabase: Awaited<ReturnType<typeof createClient>>, link: string | null): Promise<string | null> {
  if (!link) return null
  const show = link.match(/^\/shows\/([0-9a-f-]{36})/)
  if (show) return (await supabase.from('shows').select('workspace_id').eq('id', show[1]).maybeSingle()).data?.workspace_id ?? null
  const setlist = link.match(/^\/setlists\/([0-9a-f-]{36})/)
  if (setlist) return (await supabase.from('setlists').select('workspace_id').eq('id', setlist[1]).maybeSingle()).data?.workspace_id ?? null
  const task = link.match(/^\/tasks\?task=([0-9a-f-]{36})/)
  if (task) return (await supabase.from('tasks').select('workspace_id').eq('id', task[1]).maybeSingle()).data?.workspace_id ?? null
  return null
}

/**
 * Opens a notification: if it came from a workspace the user is in but isn't on right now, switches to it first,
 * then the caller navigates to the returned link. A link into another workspace would otherwise 404.
 */
export async function openNotification(id: string): Promise<{ link: string | null; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { link: null, error: 'Not authenticated' }

  const { data: n } = await supabase.from('notifications').select('link, workspace_id').eq('id', id).maybeSingle()
  if (!n) return { link: null, error: 'That notification is no longer there.' }

  const workspaceId = n.workspace_id ?? (await workspaceOfLink(supabase, n.link))
  const ctx = await getWorkspaceContext()
  if (workspaceId && ctx && ctx.current.workspace.id !== workspaceId) {
    if (!ctx.memberships.some(m => m.workspace.id === workspaceId)) return { link: null, error: 'You’re no longer in that workspace.' }
    await chooseWorkspace(workspaceId)
  }
  return { link: n.link }
}
