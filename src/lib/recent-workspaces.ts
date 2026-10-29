// Which workspaces someone used lately, newest first. Kept in the browser: a convenience for switching faster.

export const RECENT_WORKSPACES_KEY = 'tarana:recent-workspaces'

export function parseRecent(raw: string | null): string[] {
  if (!raw) return []
  try {
    const v: unknown = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** Puts a workspace at the front of the list, once, keeping only the latest few. */
export function pushRecent(list: string[], id: string, max = 5): string[] {
  return [id, ...list.filter(x => x !== id)].slice(0, max)
}

/** The workspace used just before this one, if it still exists. */
export function previousWorkspace(recent: string[], currentId: string, existing: string[]): string | null {
  return recent.find(id => id !== currentId && existing.includes(id)) ?? null
}

/** Others ordered by how recently they were used (never-used ones keep their order, after those). The current one stays first. */
export function orderByRecent<T extends { id: string }>(items: T[], recent: string[], currentId: string): T[] {
  const rank = (id: string) => { const i = recent.indexOf(id); return i === -1 ? recent.length : i }
  const current = items.filter(i => i.id === currentId)
  const others = items.filter(i => i.id !== currentId)
  return [...current, ...others.map((item, index) => ({ item, index })).sort((a, b) => rank(a.item.id) - rank(b.item.id) || a.index - b.index).map(x => x.item)]
}
