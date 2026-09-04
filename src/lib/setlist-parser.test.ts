import { describe, it, expect } from 'vitest'
import { parseSetlistText } from './setlist-parser'

describe('parseSetlistText', () => {
  it('parses a numbered song with a trailing key', () => {
    const result = parseSetlistText('1. Manovega E')
    expect(result).toEqual([{ title: 'Manovega', song_key: 'E', section: 'Main Set' }])
  })

  it('supports both "1." and "1)" numbering styles', () => {
    const result = parseSetlistText('1. Song A D\n2) Song B E')
    expect(result.map(s => s.title)).toEqual(['Song A', 'Song B'])
    expect(result.map(s => s.song_key)).toEqual(['D', 'E'])
  })

  it('leaves song_key undefined when no key is present', () => {
    const result = parseSetlistText('1. Just a title')
    expect(result).toEqual([{ title: 'Just a title', song_key: undefined, section: 'Main Set' }])
  })

  it('strips trailing punctuation before detecting the key', () => {
    const result = parseSetlistText('1. Nagumo C!')
    expect(result[0]).toEqual({ title: 'Nagumo', song_key: 'C', section: 'Main Set' })
  })

  it('treats non-numbered lines as section headers, stripping trailing colons', () => {
    const result = parseSetlistText('Set 1:\n1. Song A E\nEncore\n2. Song B D')
    expect(result).toEqual([
      { title: 'Song A', song_key: 'E', section: 'Set 1' },
      { title: 'Song B', song_key: 'D', section: 'Encore' },
    ])
  })

  it('ignores blank lines', () => {
    const result = parseSetlistText('1. Song A E\n\n\n2. Song B D')
    expect(result).toHaveLength(2)
  })

  it('recognizes minor keys as a trailing key', () => {
    const result = parseSetlistText('1. Aaromale Am')
    expect(result[0]).toEqual({ title: 'Aaromale', song_key: 'Am', section: 'Main Set' })
  })

  it('defaults to "Main Set" when no section header precedes the songs', () => {
    const result = parseSetlistText('1. Song A E')
    expect(result[0].section).toBe('Main Set')
  })
})
