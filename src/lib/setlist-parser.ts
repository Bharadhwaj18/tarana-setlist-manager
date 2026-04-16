export interface ParsedSong {
  title: string
  song_key?: string
  section: string
}

// Musical keys at end of line, e.g. "Manovega E", "Om shivoham C#", "Nagumo C"
// Handles trailing punctuation like "D!" or "E?"
const KEY_SUFFIX_RE = /\s+([A-G][#b]?m?)\s*[!?]*\s*$/

// Numbered list item: supports "1.", "1)", or tab-numbered "1.\t" patterns
const NUMBERED_ITEM_RE = /^\d+[.)]\s+(.+)/

const DEFAULT_SECTION = 'Main Set'

export function parseSetlistText(text: string): ParsedSong[] {
  const lines = text.split('\n')
  const songs: ParsedSong[] = []
  let currentSection = DEFAULT_SECTION

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    const itemMatch = line.match(NUMBERED_ITEM_RE)
    if (itemMatch) {
      // It's a song entry
      let rawTitle = itemMatch[1].trim()

      // Strip trailing punctuation before key detection
      const stripped = rawTitle.replace(/[!?]+$/, '').trim()

      const keyMatch = stripped.match(KEY_SUFFIX_RE)
      let title = stripped
      let song_key: string | undefined

      if (keyMatch && keyMatch.index !== undefined) {
        song_key = keyMatch[1]
        title = stripped.slice(0, keyMatch.index).trim()
        // Sanity check: title shouldn't be empty after stripping key
        if (!title) title = stripped
      }

      if (title) {
        songs.push({ title, song_key, section: currentSection })
      }
    } else {
      // Treat as section header — strip trailing punctuation/colons
      const sectionName = line.replace(/[!?:]+$/, '').trim()
      if (sectionName) {
        currentSection = sectionName
      }
    }
  }

  return songs
}
