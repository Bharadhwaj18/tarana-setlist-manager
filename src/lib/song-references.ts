// Song references: links to a recording of a song on Spotify, YouTube, Apple Music or SoundCloud.
// Pure helpers only, so both server and client can use them.

export const REFERENCE_SOURCES = ['spotify', 'youtube', 'apple', 'soundcloud'] as const
export type ReferenceSource = (typeof REFERENCE_SOURCES)[number]

export const SOURCE_NAMES: Record<ReferenceSource, string> = {
  spotify: 'Spotify', youtube: 'YouTube', apple: 'Apple Music', soundcloud: 'SoundCloud',
}

/** Labels offered when adding a reference. People can also type their own. */
export const REFERENCE_LABELS = ['Original', 'The version we copy', 'Live', 'Cover', 'Lesson'] as const

export const MAX_MOMENTS = 12
export const MAX_LABEL_LENGTH = 40

export interface Moment {
  label: string
  /** Seconds from the start. */
  at: number
}

/** What the app needs to show and play a reference. Built server-side, so it's plain data. */
export interface PlayableReference {
  id: string
  songId: string
  source: ReferenceSource
  url: string
  externalId: string | null
  label: string
  title: string | null
  artist: string | null
  thumbnailUrl: string | null
  moments: Moment[]
}

/** A song with its first reference, for the list's play button and the setlist rehearsal queue. */
export interface PlayableSong {
  songId: string
  title: string
  artist: string | null
  songKey: string | null
  coverUrl: string | null
  reference: PlayableReference | null
}

export interface ParsedLink {
  source: ReferenceSource
  /** Spotify track id, YouTube video id; null for Apple Music and SoundCloud (their URL is the id). */
  externalId: string | null
  /** A clean, canonical link to store. */
  url: string
}

const SPOTIFY_TRACK = /(?:open\.spotify\.com\/(?:intl-[a-z]{2}(?:-[a-z]{2})?\/)?(?:embed\/)?track\/|spotify:track:)([A-Za-z0-9]{22})/
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/

/** Works out which service a pasted link is from, or null if it isn't one we support. */
export function parseReferenceLink(input: string): ParsedLink | null {
  const raw = input.trim()
  if (!raw) return null

  const spotify = raw.match(SPOTIFY_TRACK)
  if (spotify) return { source: 'spotify', externalId: spotify[1], url: `https://open.spotify.com/track/${spotify[1]}` }

  let u: URL
  try {
    u = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`)
  } catch {
    return null
  }
  const host = u.hostname.replace(/^(www|m)\./, '')

  if (host === 'youtu.be' || host === 'youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
    let id: string | null = null
    if (host === 'youtu.be') id = u.pathname.split('/')[1] ?? null
    else if (u.pathname === '/watch') id = u.searchParams.get('v')
    else {
      const m = u.pathname.match(/^\/(?:shorts|live|embed)\/([^/?#]+)/)
      id = m ? m[1] : null
    }
    if (!id || !YOUTUBE_ID.test(id)) return null
    return { source: 'youtube', externalId: id, url: `https://www.youtube.com/watch?v=${id}` }
  }

  if (host === 'music.apple.com' && u.pathname.length > 1) {
    return { source: 'apple', externalId: null, url: `https://music.apple.com${u.pathname}${u.searchParams.get('i') ? `?i=${u.searchParams.get('i')}` : ''}` }
  }

  if ((host === 'soundcloud.com' || host === 'on.soundcloud.com') && u.pathname.split('/').filter(Boolean).length >= 1) {
    return { source: 'soundcloud', externalId: null, url: `https://${host}${u.pathname.replace(/\/$/, '')}` }
  }

  return null
}

/** "2:41" -> 161, "1:02:05" -> 3725, "95" -> 95. Null when it isn't a time. */
export function parseTime(text: string): number | null {
  const parts = text.trim().split(':')
  if (parts.length === 0 || parts.length > 3 || parts.some(p => !/^\d{1,3}$/.test(p))) return null
  const nums = parts.map(Number)
  if (nums.length > 1 && nums.slice(1).some(n => n >= 60)) return null
  return nums.reduce((total, n) => total * 60 + n, 0)
}

/** 161 -> "2:41", 3725 -> "1:02:05". */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

/** Moments from stored JSON: drops anything malformed, trims labels, sorts by time. */
export function cleanMoments(value: unknown): Moment[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((m): m is Moment => !!m && typeof m === 'object' && typeof (m as Moment).label === 'string' && typeof (m as Moment).at === 'number' && Number.isFinite((m as Moment).at))
    .map(m => ({ label: m.label.trim().slice(0, MAX_LABEL_LENGTH), at: Math.max(0, Math.floor(m.at)) }))
    .filter(m => m.label)
    .sort((a, b) => a.at - b.at)
    .slice(0, MAX_MOMENTS)
}

/** The stored columns a reference needs, as they come back from the database. */
export interface ReferenceRow {
  id: string
  song_id: string
  source: string
  url: string
  external_id: string | null
  label: string
  title: string | null
  artist: string | null
  thumbnail_url: string | null
  moments: unknown
}

export function toPlayable(r: ReferenceRow): PlayableReference | null {
  if (!(REFERENCE_SOURCES as readonly string[]).includes(r.source)) return null
  return {
    id: r.id, songId: r.song_id, source: r.source as ReferenceSource, url: r.url, externalId: r.external_id,
    label: r.label, title: r.title, artist: r.artist, thumbnailUrl: r.thumbnail_url, moments: cleanMoments(r.moments),
  }
}

/** Each song's first reference the app can play itself (rows come ordered by position), keyed by song id. */
export function firstReferenceBySong(rows: ReferenceRow[]): Record<string, PlayableReference> {
  const out: Record<string, PlayableReference> = {}
  for (const row of rows) {
    if (out[row.song_id]) continue
    const p = toPlayable(row)
    if (p && canPlayInApp(p.source)) out[row.song_id] = p
  }
  return out
}

/** Whether the app can play this source itself (and so jump to moments). Apple Music links open in Apple Music. */
export function canPlayInApp(source: ReferenceSource): boolean {
  return source !== 'apple'
}

/** A readable title from an Apple Music link's path, e.g. ".../song/beat-it/123" -> "Beat It". */
export function titleFromAppleLink(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    const kindAt = parts.findIndex(p => p === 'song' || p === 'album' || p === 'music-video')
    const slug = kindAt >= 0 ? parts[kindAt + 1] : null
    if (!slug) return null
    return decodeURIComponent(slug).split('-').filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
  } catch {
    return null
  }
}
