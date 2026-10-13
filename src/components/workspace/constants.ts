/** Suggested labels for what a workspace is for. Stored as free text, so new kinds need no database change. */
export const WORKSPACE_KINDS = ['Band', 'Solo artist', 'Venue', 'Collective', 'Other'] as const

/** Pulls the invite token out of a pasted link, or accepts the bare token. Returns null if nothing usable. */
export function extractInviteToken(input: string): string | null {
  const value = input.trim()
  if (!value) return null
  const match = value.match(/\/invite\/([^/?#\s]+)/)
  const token = match ? match[1] : value.replace(/[?#].*$/, '')
  return /^[A-Za-z0-9_-]{8,}$/.test(token) ? token : null
}
