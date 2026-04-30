import ChordSheetJS from 'chordsheetjs'

const parser = new ChordSheetJS.ChordProParser()

export function parseSong(chordChart: string) {
  try {
    // ChordProParser treats # as a comment character and drops the rest of the line.
    // Replace ASCII sharp with Unicode ♯ (U+266F) before parsing so A#, D#, etc. survive.
    const safe = (chordChart || '').replace(/#/g, '♯')
    return parser.parse(safe)
  } catch {
    return parser.parse('')
  }
}
