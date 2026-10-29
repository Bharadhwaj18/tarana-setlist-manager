// Entries logged with no signal. They're kept on the phone and added once it's back online.
// Per browser, and tied to the workspace they were made in: they only ever sync into that one.

export interface EntryPayload {
  member_id: string | null
  account_id?: string | null
  amount: number
  description: string
  category?: string | null
  show_id?: string | null
  budget_id?: string | null
  date?: string
  tags?: string[]
  project_id?: string | null
}

export interface QueuedEntry {
  id: string
  workspaceId: string
  queuedAt: string
  payload: EntryPayload
}

export const OFFLINE_QUEUE_KEY = 'tarana:offline-entries'

export function parseQueue(raw: string | null): QueuedEntry[] {
  if (!raw) return []
  try {
    const v: unknown = JSON.parse(raw)
    if (!Array.isArray(v)) return []
    return v.filter((e): e is QueuedEntry => !!e && typeof e === 'object'
      && typeof (e as QueuedEntry).id === 'string'
      && typeof (e as QueuedEntry).workspaceId === 'string'
      && !!(e as QueuedEntry).payload && typeof (e as QueuedEntry).payload.amount === 'number'
      && typeof (e as QueuedEntry).payload.description === 'string')
  } catch {
    return []
  }
}

/** Only the entries made in this workspace, oldest first, so they land in the order they happened. */
export const queuedFor = (queue: QueuedEntry[], workspaceId: string) =>
  queue.filter(e => e.workspaceId === workspaceId).sort((a, b) => a.queuedAt.localeCompare(b.queuedAt))

/** A request that failed because the phone couldn't reach the server, as opposed to the server saying no. */
export function isNetworkError(e: unknown): boolean {
  if (e instanceof TypeError) return true
  const message = e instanceof Error ? e.message : typeof e === 'string' ? e : ''
  return /failed to fetch|network ?error|load failed|networkerror|fetch failed/i.test(message)
}

// Browser storage, with the same change signal for every component on the page.
const listeners = new Set<() => void>()
export const subscribeQueue = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb) } }
const notify = () => listeners.forEach(l => l())

function read(): string | null {
  try { return window.localStorage.getItem(OFFLINE_QUEUE_KEY) } catch { return null }
}
export const queueSnapshot = () => read() ?? ''
export const loadQueue = () => parseQueue(read())

function write(queue: QueuedEntry[]): boolean {
  try {
    if (queue.length === 0) window.localStorage.removeItem(OFFLINE_QUEUE_KEY)
    else window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
  } catch {
    return false
  }
  notify()
  return true
}

/** Keeps an entry for later. False when the browser won't store it (the caller should say so, not pretend). */
export function enqueueEntry(workspaceId: string, payload: EntryPayload): boolean {
  const entry: QueuedEntry = { id: crypto.randomUUID(), workspaceId, queuedAt: new Date().toISOString(), payload }
  return write([...loadQueue(), entry])
}

export function removeQueued(id: string) {
  write(loadQueue().filter(e => e.id !== id))
}
