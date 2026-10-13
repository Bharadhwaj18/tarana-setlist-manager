/** Pulls the invite token out of a pasted invite link (or accepts the bare token). */
export function parseInviteToken(input: string): string | null {
  const text = input.trim()
  if (!text) return null
  const fromUrl = text.match(/\/invite\/([A-Za-z0-9_-]{6,})/)
  if (fromUrl) return fromUrl[1]
  return /^[A-Za-z0-9_-]{6,}$/.test(text) ? text : null
}
