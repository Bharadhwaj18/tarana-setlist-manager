import { describe, it, expect } from 'vitest'
import { buildMonthGrid, groupItemsByDate } from './calendar'
import type { Show, Note, Unavailability } from '@/types'

describe('buildMonthGrid', () => {
  it('covers all 29 days of a leap-year February without dropping any', () => {
    const weeks = buildMonthGrid(new Date(2024, 1, 1)) // Feb 2024
    const inMonth = weeks.flat().filter(d => d.inCurrentMonth)
    expect(inMonth).toHaveLength(29)
    expect(inMonth[0].date).toBe('2024-02-01')
    expect(inMonth[inMonth.length - 1].date).toBe('2024-02-29')
  })

  it('pads out to full weeks when the month starts on the grid\'s first weekday', () => {
    // September 2024 starts on a Sunday — the grid's first row should be
    // exactly that week, with no leading days borrowed from August.
    const weeks = buildMonthGrid(new Date(2024, 8, 1))
    expect(weeks[0][0].date).toBe('2024-09-01')
    expect(weeks[0][0].inCurrentMonth).toBe(true)
    weeks.forEach(week => expect(week).toHaveLength(7))
  })

  it('borrows leading/trailing days from adjacent months to fill the grid', () => {
    // March 2024 starts on a Friday — the grid's first row needs days
    // borrowed from the end of February.
    const weeks = buildMonthGrid(new Date(2024, 2, 1))
    expect(weeks[0][0].inCurrentMonth).toBe(false)
    expect(weeks[0].some(d => d.inCurrentMonth)).toBe(true)
  })
})

describe('groupItemsByDate', () => {
  const show = { show_date: '2026-09-20' } as unknown as Show
  const undatedShow = { show_date: null } as unknown as Show
  const task = { due_date: '2026-09-20' } as unknown as Note
  const undatedTask = { due_date: null } as unknown as Note
  const unavailability = { start_date: '2026-09-18', end_date: '2026-09-20' } as unknown as Unavailability

  it('buckets shows and tasks by their own date, skipping undated ones', () => {
    const byDate = groupItemsByDate([show, undatedShow], [task, undatedTask], [])
    expect(byDate['2026-09-20'].shows).toEqual([show])
    expect(byDate['2026-09-20'].tasks).toEqual([task])
    expect(Object.keys(byDate)).toEqual(['2026-09-20'])
  })

  it('expands a multi-day unavailability range across every day it spans', () => {
    const byDate = groupItemsByDate([], [], [unavailability])
    expect(byDate['2026-09-18'].unavailability).toEqual([unavailability])
    expect(byDate['2026-09-19'].unavailability).toEqual([unavailability])
    expect(byDate['2026-09-20'].unavailability).toEqual([unavailability])
    expect(byDate['2026-09-17']).toBeUndefined()
  })
})
