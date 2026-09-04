import { describe, it, expect } from 'vitest'
import { similarity, FUZZY_THRESHOLD } from './fuzzy'

describe('similarity', () => {
  it('returns 1 for identical strings', () => {
    expect(similarity('hello', 'hello')).toBe(1)
  })

  it('is case-insensitive', () => {
    expect(similarity('Hello', 'hello')).toBe(1)
  })

  it('scores highly when one string contains the other', () => {
    expect(similarity('hello', 'hell')).toBeGreaterThanOrEqual(0.9)
    expect(similarity('hell', 'hello')).toBeGreaterThanOrEqual(0.9)
  })

  it('scores low for unrelated strings', () => {
    expect(similarity('abc', 'xyz')).toBeLessThan(FUZZY_THRESHOLD)
  })

  it('tolerates a small typo above the search threshold', () => {
    // This is the actual use case: song search should survive a typo.
    expect(similarity('managment', 'management')).toBeGreaterThanOrEqual(FUZZY_THRESHOLD)
  })

  it('is symmetric', () => {
    expect(similarity('sunday', 'monday')).toBeCloseTo(similarity('monday', 'sunday'))
  })
})
