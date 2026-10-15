import ChordSheetJS from 'chordsheetjs'

const parser = new ChordSheetJS.ChordProParser()

export function parseSong(chordChart: string) {
  try {
    // ChordProParser treats # as a comment character and drops the rest of the line.
    // Replace ASCII sharp with Unicode ♯ (U+266F) before parsing so A#, D#, etc. survive.
    // A backslash is an escape character in ChordPro and makes the whole parse fail (the catch below
    // would then blank the song), so it's dropped. Lyrics often carry one as a stray line-end mark.
    const safe = (chordChart || '').replace(/#/g, '♯').replace(/\\/g, '')
    return parser.parse(safe)
  } catch {
    return parser.parse('')
  }
}
