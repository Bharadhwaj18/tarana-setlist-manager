import ChordSheetJS from 'chordsheetjs'

const parser = new ChordSheetJS.ChordProParser()

export function parseSong(chordChart: string) {
  try {
    return parser.parse(chordChart || '')
  } catch {
    // Return an empty song if parsing fails
    return parser.parse('')
  }
}
