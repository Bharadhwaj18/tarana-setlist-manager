import { describe, it, expect } from 'vitest'
import { daysUntil, countdownLabel, addDaysISO, addMonthsISO, formatDateDMY } from './dates'

describe('daysUntil', () => {
  it('is 0 for today', () => {
    expect(daysUntil('2026-09-16', '2026-09-16')).toBe(0)
  })
  it('is positive for a future date', () => {
    expect(daysUntil('2026-09-20', '2026-09-16')).toBe(4)
  })
  it('is negative for a past date', () => {
    expect(daysUntil('2026-09-10', '2026-09-16')).toBe(-6)
  })
})

describe('countdownLabel', () => {
  it('labels today/tomorrow/yesterday specially', () => {
    expect(countdownLabel('2026-09-16', '2026-09-16')).toBe('Today')
    expect(countdownLabel('2026-09-17', '2026-09-16')).toBe('Tomorrow')
    expect(countdownLabel('2026-09-15', '2026-09-16')).toBe('Yesterday')
  })
  it('counts forward for other future dates', () => {
    expect(countdownLabel('2026-09-20', '2026-09-16')).toBe('In 4 days')
  })
  it('flags overdue for older past dates', () => {
    expect(countdownLabel('2026-09-10', '2026-09-16')).toBe('6 days overdue')
  })
})

describe('addDaysISO', () => {
  it('adds days within a month', () => {
    expect(addDaysISO('2026-09-16', 3)).toBe('2026-09-19')
  })
  it('rolls over a month boundary', () => {
    expect(addDaysISO('2026-09-29', 3)).toBe('2026-10-02')
  })
  it('rolls over a year boundary', () => {
    expect(addDaysISO('2026-12-30', 3)).toBe('2027-01-02')
  })
  it('subtracts with a negative n (used for reminder lead-time math)', () => {
    expect(addDaysISO('2026-09-16', -3)).toBe('2026-09-13')
  })
})

describe('addMonthsISO', () => {
  it('adds months within a year', () => {
    expect(addMonthsISO('2026-03-15', 2)).toBe('2026-05-15')
  })
  it('rolls over a year boundary', () => {
    expect(addMonthsISO('2026-11-15', 3)).toBe('2027-02-15')
  })
  it('clamps to the last valid day of a shorter target month', () => {
    // Jan 31 + 1 month -> Feb doesn't have a 31st
    expect(addMonthsISO('2026-01-31', 1)).toBe('2026-02-28')
  })
  it('handles a leap-year February correctly', () => {
    expect(addMonthsISO('2028-01-31', 1)).toBe('2028-02-29')
  })
})

describe('formatDateDMY', () => {
  it('reorders a stored YYYY-MM-DD string to DD/MM/YYYY', () => {
    expect(formatDateDMY('2026-09-16')).toBe('16/09/2026')
  })
  it('keeps single-digit day/month zero-padded, same as the stored string', () => {
    expect(formatDateDMY('2026-01-05')).toBe('05/01/2026')
  })
})
