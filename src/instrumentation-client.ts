import posthog from 'posthog-js'

// Auto-loaded by Next.js before the app renders (special filename, no
// import needed elsewhere) — the official Next.js App Router install path.
// `defaults` pulls in PostHog's current recommended settings, including
// pageview capture across client-side route changes, so nothing extra is
// needed to track navigation in this App Router app.
if (process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    defaults: '2026-05-30',
    // Only start tracking a person once we've identified them (see
    // IdentifyUser) — no anonymous/public pages worth tracking pre-login.
    person_profiles: 'identified_only',
  })
}
