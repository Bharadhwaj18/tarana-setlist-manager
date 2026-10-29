// What someone chose the last time they logged money, so the next entry starts from there. Kept in the browser,
// per workspace: it's a convenience, not data.

export interface LastEntry {
  dir: 'credit' | 'debit'
  /** Null when the last entry was a reimbursement: that kind needs a person each time, so it isn't carried over. */
  category: string | null
  /** An "acct:<id>" value, or '' for the person logging it. Never another member. */
  holder: string
}

export const lastEntryKey = (workspaceId: string) => `tarana:last-entry:${workspaceId}`

export function parseLastEntry(raw: string | null): LastEntry | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as Partial<LastEntry> | null
    if (!v || (v.dir !== 'credit' && v.dir !== 'debit')) return null
    return {
      dir: v.dir,
      category: typeof v.category === 'string' ? v.category : null,
      holder: typeof v.holder === 'string' ? v.holder : '',
    }
  } catch {
    return null
  }
}

export function loadLastEntry(workspaceId: string): LastEntry | null {
  if (typeof window === 'undefined' || !workspaceId) return null
  try {
    return parseLastEntry(window.localStorage.getItem(lastEntryKey(workspaceId)))
  } catch {
    return null
  }
}

export function saveLastEntry(workspaceId: string, entry: LastEntry) {
  if (typeof window === 'undefined' || !workspaceId) return
  try {
    window.localStorage.setItem(lastEntryKey(workspaceId), JSON.stringify(entry))
  } catch {
    // Private windows and full storage just mean nothing is remembered.
  }
}

/**
 * Turns what was saved into starting values that are still allowed today: a category that has since been hidden,
 * or an account that has since been archived, quietly falls back to the form's usual default (null).
 */
export function resolveLastEntry(
  last: LastEntry | null,
  allowed: { categories: (dir: 'credit' | 'debit') => string[]; accountValues: string[] },
): { dir: 'credit' | 'debit'; category: string | null; holder: string | null } | null {
  if (!last) return null
  const category = last.category && allowed.categories(last.dir).includes(last.category) ? last.category : null
  const holder = last.holder && allowed.accountValues.includes(last.holder) ? last.holder : null
  return { dir: last.dir, category, holder }
}
