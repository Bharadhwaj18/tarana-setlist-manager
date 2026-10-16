// Server only: looks up a reference link's title, artist and cover, and searches Spotify.
// Spotify's Web API needs SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET (app keys, no user sign-in).
// Without them, Spotify links fall back to Spotify's public oEmbed (title and cover only).

import { SOURCE_NAMES, parseReferenceLink, titleFromAppleLink, type ReferenceSource } from '@/lib/song-references'

export interface ReferenceDetails {
  source: ReferenceSource
  url: string
  externalId: string | null
  title: string | null
  artist: string | null
  album: string | null
  thumbnailUrl: string | null
  durationMs: number | null
}

export interface SpotifyResult {
  id: string
  url: string
  title: string
  artist: string
  album: string
  thumbnailUrl: string | null
  durationMs: number
}

const TIMEOUT_MS = 6000

async function getJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export function spotifyConfigured() {
  return !!process.env.SPOTIFY_CLIENT_ID && !!process.env.SPOTIFY_CLIENT_SECRET
}

// One app token, reused until shortly before it expires (they last an hour).
let token: { value: string; expiresAt: number } | null = null

async function spotifyToken(): Promise<string | null> {
  if (!spotifyConfigured()) return null
  if (token && token.expiresAt > Date.now() + 60_000) return token.value
  const basic = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')
  const data = await getJson<{ access_token: string; expires_in: number }>('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })
  if (!data?.access_token) return null
  token = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
  return token.value
}

interface SpotifyTrack {
  id: string
  name: string
  duration_ms: number
  artists: { name: string }[]
  album: { name: string; images: { url: string; width: number }[] }
}

const toResult = (t: SpotifyTrack): SpotifyResult => ({
  id: t.id,
  url: `https://open.spotify.com/track/${t.id}`,
  title: t.name,
  artist: t.artists.map(a => a.name).join(', '),
  album: t.album.name,
  // Spotify lists images largest first; the 300px one is plenty for a cover.
  thumbnailUrl: t.album.images.find(i => i.width <= 320)?.url ?? t.album.images[0]?.url ?? null,
  durationMs: t.duration_ms,
})

export async function searchSpotify(query: string): Promise<SpotifyResult[] | null> {
  const bearer = await spotifyToken()
  if (!bearer) return null
  const data = await getJson<{ tracks: { items: SpotifyTrack[] } }>(
    `https://api.spotify.com/v1/search?type=track&limit=8&q=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Bearer ${bearer}` } },
  )
  return data ? data.tracks.items.map(toResult) : []
}

async function spotifyTrack(id: string): Promise<SpotifyResult | null> {
  const bearer = await spotifyToken()
  if (!bearer) return null
  const data = await getJson<SpotifyTrack>(`https://api.spotify.com/v1/tracks/${id}`, { headers: { Authorization: `Bearer ${bearer}` } })
  return data ? toResult(data) : null
}

interface OEmbed { title?: string; author_name?: string; thumbnail_url?: string }

/** Title, artist and cover for a pasted link. Null when the link isn't from a service we support. */
export async function lookupReference(link: string): Promise<ReferenceDetails | null> {
  const parsed = parseReferenceLink(link)
  if (!parsed) return null
  const base: ReferenceDetails = { ...parsed, title: null, artist: null, album: null, thumbnailUrl: null, durationMs: null }

  if (parsed.source === 'spotify' && parsed.externalId) {
    const track = await spotifyTrack(parsed.externalId)
    if (track) return { ...base, title: track.title, artist: track.artist, album: track.album, thumbnailUrl: track.thumbnailUrl, durationMs: track.durationMs }
    const o = await getJson<OEmbed>(`https://open.spotify.com/oembed?url=${encodeURIComponent(parsed.url)}`)
    return { ...base, title: o?.title ?? null, thumbnailUrl: o?.thumbnail_url ?? null }
  }
  if (parsed.source === 'youtube') {
    const o = await getJson<OEmbed>(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(parsed.url)}`)
    return { ...base, title: o?.title ?? null, artist: o?.author_name ?? null, thumbnailUrl: o?.thumbnail_url ?? null }
  }
  if (parsed.source === 'soundcloud') {
    const o = await getJson<OEmbed>(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(parsed.url)}`)
    // SoundCloud titles read "Track by Artist"; keep just the track.
    const title = o?.title && o.author_name ? o.title.replace(new RegExp(` by ${o.author_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '') : o?.title ?? null
    return { ...base, title, artist: o?.author_name ?? null, thumbnailUrl: o?.thumbnail_url ?? null }
  }
  return { ...base, title: titleFromAppleLink(parsed.url) }
}

export const sourceName = (s: ReferenceSource) => SOURCE_NAMES[s]
