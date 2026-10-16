// Browser only: loads Spotify's, YouTube's and SoundCloud's player scripts once, on first use.
// Each one lets the app play, pause and jump to a time inside the service's own embedded player.

export interface SpotifyPlayback { isPaused: boolean; position: number; duration: number }
export interface SpotifyController {
  play(): void
  pause(): void
  resume(): void
  togglePlay(): void
  seek(seconds: number): void
  destroy(): void
  addListener(event: 'ready', cb: () => void): void
  addListener(event: 'playback_update', cb: (e: { data: SpotifyPlayback }) => void): void
}
interface SpotifyIFrameApi {
  createController(el: HTMLElement, opts: { uri: string; width?: string | number; height?: string | number }, cb: (c: SpotifyController) => void): void
}

export interface YTPlayer {
  seekTo(seconds: number, allowSeekAhead: boolean): void
  playVideo(): void
  pauseVideo(): void
  getCurrentTime(): number
  /** 1 = playing, 2 = paused, 0 = ended. */
  getPlayerState(): number
  destroy(): void
}
interface YTNamespace {
  Player: new (el: HTMLElement, opts: {
    videoId: string
    width?: string
    height?: string
    host?: string
    playerVars?: Record<string, number | string>
    events?: { onStateChange?: (e: { data: number }) => void }
  }) => YTPlayer
}

export interface SCWidget {
  seekTo(ms: number): void
  play(): void
  pause(): void
  toggle(): void
  bind(event: string, cb: (e?: { currentPosition?: number }) => void): void
}
interface SCNamespace {
  Widget: ((el: HTMLIFrameElement) => SCWidget) & { Events: { FINISH: string; PLAY_PROGRESS: string; PLAY: string; PAUSE: string } }
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIFrameApi) => void
    onYouTubeIframeAPIReady?: () => void
    YT?: YTNamespace
    SC?: SCNamespace
  }
}

const LOAD_TIMEOUT_MS = 12000

function addScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if (existing) { resolve(); return }
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`Couldn't load ${src}`))
    document.head.appendChild(s)
  })
}

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Player took too long to load')), LOAD_TIMEOUT_MS))])
}

let spotify: Promise<SpotifyIFrameApi> | null = null
export function loadSpotify(): Promise<SpotifyIFrameApi> {
  if (!spotify) {
    spotify = withTimeout(new Promise<SpotifyIFrameApi>((resolve, reject) => {
      window.onSpotifyIframeApiReady = api => resolve(api)
      addScript('https://open.spotify.com/embed/iframe-api/v1').catch(reject)
    }))
    spotify.catch(() => { spotify = null })
  }
  return spotify
}

let youtube: Promise<YTNamespace> | null = null
export function loadYouTube(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (!youtube) {
    youtube = withTimeout(new Promise<YTNamespace>((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => { previous?.(); if (window.YT) resolve(window.YT) }
      addScript('https://www.youtube.com/iframe_api').catch(reject)
    }))
    youtube.catch(() => { youtube = null })
  }
  return youtube
}

export async function loadSoundCloud(): Promise<SCNamespace> {
  if (window.SC?.Widget) return window.SC
  await withTimeout(addScript('https://w.soundcloud.com/player/api.js'))
  if (!window.SC) throw new Error('SoundCloud player missing')
  return window.SC
}
