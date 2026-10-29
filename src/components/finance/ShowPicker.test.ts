import { describe, expect, it } from 'vitest'
import { showMatches } from './ShowPicker'

const show = { title: 'BMC Wedding', venue: 'Lalit Ashok', show_date: '2026-11-14' }

describe('showMatches', () => {
  it('matches on any part of the name, letter by letter', () => {
    expect(showMatches(show, 'b')).toBe(true)
    expect(showMatches(show, 'bmc')).toBe(true)
    expect(showMatches(show, 'WEDD')).toBe(true)
    expect(showMatches(show, 'xyz')).toBe(false)
  })
  it('matches the venue and the date too', () => {
    expect(showMatches(show, 'lalit')).toBe(true)
    expect(showMatches(show, '2026-11')).toBe(true)
  })
  it('needs every word typed to match', () => {
    expect(showMatches(show, 'bmc lalit')).toBe(true)
    expect(showMatches(show, 'bmc goa')).toBe(false)
  })
  it('shows everything for an empty search', () => {
    expect(showMatches(show, '')).toBe(true)
    expect(showMatches({ title: 'X', venue: null, show_date: null }, '  ')).toBe(true)
  })
})
