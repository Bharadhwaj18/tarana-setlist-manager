const LS_SETLISTS = 'tarana-offline-setlists'
const LS_SONGS = 'tarana-offline-songs'
const LS_USER = 'tarana-user'

export interface OfflineMeta {
  id: string
  title: string
  songCount: number
  savedAt: string
}

export interface OfflineSongMeta {
  id: string
  title: string
  artist: string | null
  song_key: string | null
  setlistId: string
  setlistTitle: string
}

export interface OfflineUser {
  email: string
  displayName: string
}

// ── User session ────────────────────────────────────────────────

export function saveUserOffline(user: OfflineUser) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(LS_USER, JSON.stringify(user))
}

// ── Setlist metadata ────────────────────────────────────────────

export function getOfflineMetas(): OfflineMeta[] {
  if (typeof localStorage === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(LS_SETLISTS) ?? '[]') } catch { return [] }
}

export function isSetlistSavedOffline(id: string): boolean {
  return getOfflineMetas().some(s => s.id === id)
}

// ── Song metadata ───────────────────────────────────────────────

function getOfflineSongs(): OfflineSongMeta[] {
  if (typeof localStorage === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(LS_SONGS) ?? '[]') } catch { return [] }
}

// ── Save / remove ───────────────────────────────────────────────

export async function saveSetlistOffline(
  setlistId: string,
  setlistTitle: string,
  html: string,
  songs: OfflineSongMeta[]
): Promise<void> {
  // Setlist metadata
  const metas = getOfflineMetas().filter(s => s.id !== setlistId)
  metas.push({ id: setlistId, title: setlistTitle, songCount: songs.length, savedAt: new Date().toISOString() })
  localStorage.setItem(LS_SETLISTS, JSON.stringify(metas))

  // Song metadata (merge, keeping songs from other setlists)
  const existing = getOfflineSongs().filter(s => s.setlistId !== setlistId)
  localStorage.setItem(LS_SONGS, JSON.stringify([...existing, ...songs]))

  // Send HTML to service worker cache
  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.ready
    const url = `${window.location.origin}/setlists/${setlistId}`
    reg.active?.postMessage({ type: 'CACHE_SETLIST', url, html })
  }
}

export async function removeSetlistOffline(setlistId: string): Promise<void> {
  localStorage.setItem(LS_SETLISTS, JSON.stringify(getOfflineMetas().filter(s => s.id !== setlistId)))
  localStorage.setItem(LS_SONGS, JSON.stringify(getOfflineSongs().filter(s => s.setlistId !== setlistId)))

  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.ready
    const url = `${window.location.origin}/setlists/${setlistId}`
    reg.active?.postMessage({ type: 'REMOVE_SETLIST', url })
  }
}
