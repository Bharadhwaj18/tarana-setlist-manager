import { describe, it, expect } from 'vitest'
import { parseSong } from './parser'
import { formatSong } from './formatter'

describe('parseSong', () => {
  it('parses a basic ChordPro chart into chords and lyrics', () => {
    const html = formatSong(parseSong('{title: Test}\n[A]Hello [D]world'))
    expect(html).toContain('>A<')
    expect(html).toContain('>D<')
    expect(html).toContain('Hello')
    expect(html).toContain('world')
  })

  it('never throws on empty input', () => {
    expect(() => parseSong('')).not.toThrow()
  })

  it('falls back to an empty song instead of throwing on malformed input', () => {
    // Deliberately unbalanced ChordPro directive
    expect(() => parseSong('{title: Unterminated')).not.toThrow()
  })

  // Regression test for the "#" comment-stripping bug (fixed by replacing
  // ASCII sharp with Unicode ♯ before parsing — see git history). Without
  // that fix, ChordProParser treats a bare "#" as a line comment and
  // silently drops everything after it, including later chords.
  describe('sharp ("#") handling', () => {
    it('keeps a sharp chord that opens a line', () => {
      const html = formatSong(parseSong('{title: Test}\n[A#]Hello [D#]world'))
      expect(html).toContain('Hello')
      expect(html).toContain('world')
    })

    it('does not truncate the line at a bare "#" in the lyrics', () => {
      const html = formatSong(parseSong('{title: Test}\n[C#]Verse #1 [D#]here'))
      // The historical bug dropped everything from the bare "#" onward,
      // losing both "here" and the D# chord entirely.
      expect(html).toContain('here')
      expect(html).toContain('D♯')
    })
  })
})
