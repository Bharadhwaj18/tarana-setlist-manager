'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'

interface Props {
  userId: string
  email?: string | null
  name?: string | null
}

// Ties every event this person generates back to them by Supabase user id
// — without this, PostHog would only ever see anonymous, device-scoped
// visitors, which defeats "who uses what a lot." PostHog itself is
// initialized in src/instrumentation-client.ts; this just calls into it.
export function IdentifyUser({ userId, email, name }: Props) {
  useEffect(() => {
    posthog.identify(userId, { email: email ?? undefined, name: name ?? undefined })
  }, [userId, email, name])

  return null
}
