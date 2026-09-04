// Shared constants for the "active setlist" cookie — the persistent fallback
// that keeps a song page (and its edit page) scoped to whichever setlist you
// last opened a song from, even when a specific navigation drops the `from`
// query param (browser back/forward, a bookmarked/shared URL, etc).
//
// The `?from=/setlists/<id>` query param is still the explicit, authoritative
// source whenever present — this cookie is only the fallback, and gets kept
// in sync with whatever the explicit source last resolved to. It's cleared
// only by an explicit exit (clicking "Songs" in the nav), never by simply
// viewing a song without `from` — that's the whole point: context persists
// until you deliberately leave it, not just because one link forgot it.
//
// No `next/headers` import here (deliberately) — this file is imported from
// both Server Components (reading the cookie) and Client Components (writing
// it via `document.cookie`), and pulling in a server-only module would break
// the client bundle.
export const ACTIVE_SETLIST_COOKIE = 'active_setlist_id'
export const ACTIVE_SETLIST_COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days
