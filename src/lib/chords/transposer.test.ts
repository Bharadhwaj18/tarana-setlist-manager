import { describe, it, expect } from 'vitest'
import { transposeKey, getSemitoneDelta, transposeSong } from './transposer'
import { parseSong } from './parser'
import { formatSong } from './formatter'

describe('transposeKey', () => {
  it('moves a major key up by semitones', () => {
    expect(transposeKey('C', 2)).toBe('D')
  })

  it('wraps around the top of the chromatic scale', () => {
    expect(transposeKey('B', 1)).toBe('C')
  })

  it('wraps around going down past C', () => {
    expect(transposeKey('C', -1)).toBe('B')
  })

  it('preserves minor keys', () => {
    expect(transposeKey('Am', 3)).toBe('Cm')
  })

  it('normalizes flats to their sharp equivalent', () => {
    expect(transposeKey('Db', 0)).toBe('C#')
    expect(transposeKey('Bb', 2)).toBe('C')
  })

  it('returns null for a null/undefined key', () => {
    expect(transposeKey(null, 5)).toBeNull()
    expect(transposeKey(undefined, 5)).toBeNull()
  })

  it('returns an unrecognized key unchanged', () => {
    expect(transposeKey('NotAKey', 2)).toBe('NotAKey')
  })

  it('is a no-op at 0 semitones for an already-normalized key', () => {
    expect(transposeKey('G', 0)).toBe('G')
  })
})

describe('getSemitoneDelta', () => {
  it('computes the distance between two major keys', () => {
    expect(getSemitoneDelta('C', 'D')).toBe(2)
  })

  it('returns 0 for the same key', () => {
    expect(getSemitoneDelta('C', 'C')).toBe(0)
  })

  it('wraps around when the target key is "behind" the source', () => {
    expect(getSemitoneDelta('D', 'C')).toBe(10)
  })

  it('ignores the minor suffix when computing distance', () => {
    expect(getSemitoneDelta('Am', 'Cm')).toBe(3)
  })

  it('returns 0 for an unrecognized key on either side', () => {
    expect(getSemitoneDelta('NotAKey', 'C')).toBe(0)
    expect(getSemitoneDelta('C', 'NotAKey')).toBe(0)
  })
})

describe('transposeSong (integration with parser/formatter)', () => {
  it('shifts every chord in the sheet by the given semitones', () => {
    const song = parseSong('{title: Test}\n[A]Hello [D]world')
    const transposed = transposeSong(song, 2)
    const html = formatSong(transposed)
    expect(html).toContain('>B<')
    expect(html).toContain('>E<')
  })
})
