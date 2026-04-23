import ChordSheetJS from 'chordsheetjs'
import type { Song } from 'chordsheetjs'

const htmlFormatter = new ChordSheetJS.HtmlDivFormatter()
const chordProFormatter = new ChordSheetJS.ChordProFormatter()

export function formatSong(song: Song): string {
  return htmlFormatter.format(song)
}

export function formatSongAsChordPro(song: Song): string {
  return chordProFormatter.format(song)
}

export function getCss(): string {
  return htmlFormatter.cssString()
}
