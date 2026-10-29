import { describe, expect, it } from 'vitest'
import { orderByRecent, parseRecent, previousWorkspace, pushRecent } from './recent-workspaces'

describe('parseRecent', () => {
  it('reads a saved list and ignores junk', () => {
    expect(parseRecent('["a","b"]')).toEqual(['a', 'b'])
    expect(parseRecent('[1,"a"]')).toEqual(['a'])
    expect(parseRecent('{}')).toEqual([])
    expect(parseRecent('nope')).toEqual([])
    expect(parseRecent(null)).toEqual([])
  })
})

describe('pushRecent', () => {
  it('moves a workspace to the front without repeating it', () => {
    expect(pushRecent(['a', 'b', 'c'], 'c')).toEqual(['c', 'a', 'b'])
  })
  it('keeps only the latest few', () => {
    expect(pushRecent(['a', 'b', 'c'], 'd', 3)).toEqual(['d', 'a', 'b'])
  })
})

describe('previousWorkspace', () => {
  it('is the most recent other workspace that still exists', () => {
    expect(previousWorkspace(['b', 'a', 'c'], 'b', ['a', 'b', 'c'])).toBe('a')
    expect(previousWorkspace(['b', 'gone', 'c'], 'b', ['b', 'c'])).toBe('c')
  })
  it('is null with nothing to go back to', () => {
    expect(previousWorkspace(['a'], 'a', ['a'])).toBeNull()
    expect(previousWorkspace([], 'a', ['a', 'b'])).toBeNull()
  })
})

describe('orderByRecent', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]
  it('keeps the current one first, then the most recently used', () => {
    expect(orderByRecent(items, ['c', 'a'], 'b').map(i => i.id)).toEqual(['b', 'c', 'a', 'd'])
  })
  it('keeps the original order for ones never used', () => {
    expect(orderByRecent(items, [], 'c').map(i => i.id)).toEqual(['c', 'a', 'b', 'd'])
  })
})
