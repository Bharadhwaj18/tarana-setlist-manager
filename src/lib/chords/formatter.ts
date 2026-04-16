import ChordSheetJS from 'chordsheetjs'
import type { Song } from 'chordsheetjs'

const formatter = new ChordSheetJS.HtmlDivFormatter()

export function formatSong(song: Song): string {
  return formatter.format(song)
}

export function getCss(): string {
  return formatter.cssString()
}
