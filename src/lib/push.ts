import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Server-only — imports web-push, which needs Node's crypto for VAPID
// signing. Never import this from a client component, and never move
// anything that imports it onto the Edge runtime.
// Reuses the same public key the client subscribes with (NEXT_PUBLIC_* is
// fine to read server-side too — it's public by definition) so there's
// only one public-key value to keep in sync, not two.
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

export interface PushPayload {
  title: string
  body?: string | null
  link?: string | null
}

/**
 * Which subscriptions to prune, given the settled results of pushing to
 * each — a 404/410 means the browser unsubscribed or the endpoint expired,
 * so it's dead and should stop being retried forever. Pulled out as a pure
 * function (no Supabase/web-push involved) so it's unit-testable without
 * mocking either.
 */
export function findDeadEndpoints<T extends { endpoint: string }>(
  subscriptions: T[],
  results: PromiseSettledResult<unknown>[]
): string[] {
  return subscriptions
    .filter((_, i) => {
      const result = results[i]
      return result.status === 'rejected' && [404, 410].includes((result.reason as { statusCode?: number })?.statusCode ?? 0)
    })
    .map(sub => sub.endpoint)
}

/**
 * Best-effort push to every device a profile has subscribed on. A push
 * failure here never fails the caller — the notifications row is already
 * the source of truth; push is just a bonus alert on top of it. Any
 * subscription that comes back 404/410 (the browser unsubscribed or the
 * endpoint expired) is pruned so it stops being retried forever.
 */
export async function sendPushToProfile(
  supabase: SupabaseClient<Database>,
  profileId: string,
  payload: PushPayload
) {
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('profile_id', profileId)

  if (!subscriptions?.length) return

  const results = await Promise.allSettled(
    subscriptions.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      )
    )
  )

  const deadEndpoints = findDeadEndpoints(subscriptions, results)

  if (deadEndpoints.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', deadEndpoints)
  }
}
