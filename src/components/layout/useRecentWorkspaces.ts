'use client'

import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { RECENT_WORKSPACES_KEY, parseRecent, pushRecent } from '@/lib/recent-workspaces'

const listeners = new Set<() => void>()
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb) } }
const read = () => { try { return window.localStorage.getItem(RECENT_WORKSPACES_KEY) } catch { return null } }
const getSnapshot = () => read() ?? ''

/** The workspaces used lately, newest first. Also notes the current one as used. Empty on the server and first paint. */
export function useRecentWorkspaces(currentId: string): string[] {
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => '')
  const list = useMemo(() => parseRecent(raw || null), [raw])

  useEffect(() => {
    if (!currentId) return
    const saved = parseRecent(read())
    if (saved[0] === currentId) return
    try { window.localStorage.setItem(RECENT_WORKSPACES_KEY, JSON.stringify(pushRecent(saved, currentId))) } catch { return }
    listeners.forEach(l => l())
  }, [currentId])

  return list
}
