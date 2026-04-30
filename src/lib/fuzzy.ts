export const FUZZY_THRESHOLD = 0.4

export function similarity(a: string, b: string): number {
  a = a.toLowerCase()
  b = b.toLowerCase()
  if (a === b) return 1
  if (b.includes(a) || a.includes(b)) return 0.9

  let i = 0, j = 0, matches = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { matches++; i++; j++ }
    else { j++ }
  }
  const subseqScore = matches / Math.max(a.length, b.length)

  const bigrams = (s: string) => {
    const set = new Set<string>()
    for (let k = 0; k < s.length - 1; k++) set.add(s[k] + s[k + 1])
    return set
  }
  const ba = bigrams(a), bb = bigrams(b)
  let shared = 0
  ba.forEach(g => { if (bb.has(g)) shared++ })
  const bigramScore = (2 * shared) / (ba.size + bb.size || 1)

  return Math.max(subseqScore, bigramScore)
}
