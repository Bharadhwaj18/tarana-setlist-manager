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
      const rawTitle = itemMatch[1].trim()

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

export interface SetlistTextSong {
  title: string
  song_key?: string | null
  section?: string | null
}

// Inverse of parseSetlistText — regenerates the same bulk-import-style text
// from a setlist's current songs, so it can be shown back for editing (e.g.
// to fix a section that was actually a mis-parsed song title). A song with
// no section is written under the same "Main Set" default parseSetlistText
// itself falls back to, so re-parsing the unedited text reproduces the
// exact same structure — this is a deliberate, lossy-by-design choice, not
// an oversight (there's no way to write "no section" in this format).
export function serializeSetlistText(songs: SetlistTextSong[]): string {
  const lines: string[] = []
  let lastSection: string | null = null
  let n = 0

  for (const song of songs) {
    const section = song.section?.trim() || DEFAULT_SECTION
    if (section !== lastSection) {
      if (lines.length > 0) lines.push('')
      lines.push(section)
      lastSection = section
      n = 0
    }
    n++
    const keySuffix = song.song_key ? ` ${song.song_key}` : ''
    lines.push(`${n}. ${song.title}${keySuffix}`)
  }

  return lines.join('\n')
}
