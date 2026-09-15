import { describe, it, expect, vi, afterEach } from 'vitest'
import { todayISO, isUpcoming, canonicalCity } from './shows'

describe('todayISO', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses the IST calendar date, not the runtime\'s own timezone', () => {
    // 19:00 UTC on the 15th is 00:30 IST on the 16th — a UTC-based
    // deploy server (Vercel's default) would get this wrong if it read
    // its own local date instead of explicitly converting to IST.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-15T19:00:00.000Z'))
    expect(todayISO()).toBe('2026-09-16')
  })

  it('still lands on the same day for a time safely inside the IST day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-16T10:00:00.000Z')) // 15:30 IST
    expect(todayISO()).toBe('2026-09-16')
  })
})

describe('isUpcoming', () => {
  it('is true only for a date strictly after today', () => {
    expect(isUpcoming('2026-09-20', '2026-09-16')).toBe(true)
    expect(isUpcoming('2026-09-16', '2026-09-16')).toBe(false)
    expect(isUpcoming('2026-09-10', '2026-09-16')).toBe(false)
    expect(isUpcoming(null, '2026-09-16')).toBe(false)
  })
})

describe('canonicalCity', () => {
  it('folds known spelling variants to one canonical name', () => {
    expect(canonicalCity('bengaluru')).toBe('Bangalore')
    expect(canonicalCity('Bangalore')).toBe('Bangalore')
    expect(canonicalCity('bngaluru')).toBe('Bangalore')
  })

  it('title-cases unrecognized cities', () => {
    expect(canonicalCity('udupi')).toBe('Udupi')
  })
})
