// Server only: looks up a reference link's title, artist and cover, and searches Spotify and YouTube.
// Spotify's Web API needs SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET (app keys, no user sign-in; since
// February 2026 the app owner needs Spotify Premium). Without them, Spotify links fall back to Spotify's
// public oEmbed (title and cover only). YouTube search needs YOUTUBE_API_KEY (free, YouTube Data API v3).

import { parseReferenceLink, titleFromAppleLink, type ReferenceSource } from '@/lib/song-references'

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

/** Services the add-reference sheet can search. */
export type SearchSource = 'youtube' | 'spotify'

export interface SearchResult {
  source: SearchSource
  id: string
  url: string
  title: string
  artist: string
  album: string | null
  thumbnailUrl: string | null
  durationMs: number | null
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
export function youtubeConfigured() {
  return !!process.env.YOUTUBE_API_KEY
}

/** Which search tabs to offer: only services whose keys are set. YouTube first, since it needs no paid account. */
export function availableSearchSources(): SearchSource[] {
  return [youtubeConfigured() && 'youtube', spotifyConfigured() && 'spotify'].filter((s): s is SearchSource => !!s)
}

// ---------------- Spotify ----------------

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

const fromSpotify = (t: SpotifyTrack): SearchResult => ({
  source: 'spotify',
  id: t.id,
  url: `https://open.spotify.com/track/${t.id}`,
  title: t.name,
  artist: t.artists.map(a => a.name).join(', '),
  album: t.album.name,
  // Spotify lists images largest first; the 300px one is plenty for a cover.
  thumbnailUrl: t.album.images.find(i => i.width <= 320)?.url ?? t.album.images[0]?.url ?? null,
  durationMs: t.duration_ms,
})

async function searchSpotify(query: string): Promise<SearchResult[] | null> {
  const bearer = await spotifyToken()
  if (!bearer) return null
  // Development Mode apps get at most 10 results per search.
  const data = await getJson<{ tracks: { items: SpotifyTrack[] } }>(
    `https://api.spotify.com/v1/search?type=track&limit=8&q=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Bearer ${bearer}` } },
  )
  return data ? data.tracks.items.map(fromSpotify) : null
}

async function spotifyTrack(id: string): Promise<SearchResult | null> {
  const bearer = await spotifyToken()
  if (!bearer) return null
  const data = await getJson<SpotifyTrack>(`https://api.spotify.com/v1/tracks/${id}`, { headers: { Authorization: `Bearer ${bearer}` } })
  return data ? fromSpotify(data) : null
}

// ---------------- YouTube ----------------

interface YouTubeSearch {
  items: { id: { videoId?: string }; snippet: { title: string; channelTitle: string; thumbnails: { medium?: { url: string }; default?: { url: string } } } }[]
}

/** YouTube returns titles with HTML entities ("Don&#39;t"); turn them back into text. */
function decodeEntities(text: string) {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

/** "PT4M18S" -> 258000. */
export function isoDurationMs(iso: string): number | null {
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)
  if (!m) return null
  return ((Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0)) * 60 + Number(m[3] ?? 0)) * 1000
}

// Each search costs 100 of the default 10,000 daily quota units (about 100 searches a day); durations cost 1 more.
async function searchYouTube(query: string): Promise<SearchResult[] | null> {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) return null
  const data = await getJson<YouTubeSearch>(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=8&q=${encodeURIComponent(query)}&key=${key}`,
  )
  if (!data) return null
  const items = data.items.filter(i => i.id.videoId)
  const ids = items.map(i => i.id.videoId!).join(',')
  const details = ids
    ? await getJson<{ items: { id: string; contentDetails: { duration: string } }[] }>(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids}&key=${key}`)
    : null
  const durations = new Map((details?.items ?? []).map(v => [v.id, isoDurationMs(v.contentDetails.duration)]))
  return items.map(i => {
    const id = i.id.videoId!
    return {
      source: 'youtube',
      id,
      url: `https://www.youtube.com/watch?v=${id}`,
      title: decodeEntities(i.snippet.title),
      // Album versions come from "Artist - Topic" channels; the rest is the uploader's name.
      artist: decodeEntities(i.snippet.channelTitle).replace(/ - Topic$/, ''),
      album: null,
      thumbnailUrl: i.snippet.thumbnails.medium?.url ?? i.snippet.thumbnails.default?.url ?? null,
      durationMs: durations.get(id) ?? null,
    }
  })
}

export async function searchSource(source: SearchSource, query: string): Promise<SearchResult[] | null> {
  return source === 'spotify' ? searchSpotify(query) : searchYouTube(query)
}

// ---------------- link lookup ----------------

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
    return { ...base, title: o?.title ?? null, artist: o?.author_name?.replace(/ - Topic$/, '') ?? null, thumbnailUrl: o?.thumbnail_url ?? null }
  }
  if (parsed.source === 'soundcloud') {
    const o = await getJson<OEmbed>(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(parsed.url)}`)
    // SoundCloud titles read "Track by Artist"; keep just the track.
    const title = o?.title && o.author_name && o.title.endsWith(` by ${o.author_name}`) ? o.title.slice(0, -` by ${o.author_name}`.length) : o?.title ?? null
    return { ...base, title, artist: o?.author_name ?? null, thumbnailUrl: o?.thumbnail_url ?? null }
  }
  return { ...base, title: titleFromAppleLink(parsed.url) }
}
