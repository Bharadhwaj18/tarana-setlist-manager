import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns'
import { toISODate, parseISODate } from './dates'
import type { Show, Note, Unavailability, CalendarEvent } from '@/types'

export interface CalendarDay {
  date: string
  inCurrentMonth: boolean
}

/**
 * A full-week-aligned month grid (weeks of 7, Sunday-start) — includes the
 * leading/trailing days from the adjacent months needed to fill out the
 * first and last week, same as Google Calendar's month view.
 */
export function buildMonthGrid(monthDate: Date): CalendarDay[][] {
  const monthStart = startOfMonth(monthDate)
  const monthEnd = endOfMonth(monthDate)
  const gridStart = startOfWeek(monthStart)
  const gridEnd = endOfWeek(monthEnd)

  const days = eachDayOfInterval({ start: gridStart, end: gridEnd }).map(d => ({
    date: toISODate(d),
    inCurrentMonth: d.getMonth() === monthDate.getMonth(),
  }))

  const weeks: CalendarDay[][] = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))
  return weeks
}

export interface DayItems {
  shows: Show[]
  tasks: Note[]
  unavailability: Unavailability[]
  events: CalendarEvent[]
}

/**
 * Groups shows (by show_date), tasks (by due_date), unavailability, and
 * freeform events (both of the latter expanded across their whole
 * start_date..end_date range) into one YYYY-MM-DD-keyed lookup, so
 * rendering a day cell is an O(1) lookup instead of filtering every list
 * per cell.
 */
export function groupItemsByDate(shows: Show[], tasks: Note[], unavailability: Unavailability[], events: CalendarEvent[] = []): Record<string, DayItems> {
  const byDate: Record<string, DayItems> = {}
  const bucket = (date: string) => (byDate[date] ??= { shows: [], tasks: [], unavailability: [], events: [] })

  for (const show of shows) {
    if (show.show_date) bucket(show.show_date).shows.push(show)
  }
  for (const task of tasks) {
    if (task.due_date) bucket(task.due_date).tasks.push(task)
  }
  for (const entry of unavailability) {
    const days = eachDayOfInterval({ start: parseISODate(entry.start_date), end: parseISODate(entry.end_date) })
    for (const day of days) bucket(toISODate(day)).unavailability.push(entry)
  }
  for (const event of events) {
    const days = eachDayOfInterval({ start: parseISODate(event.start_date), end: parseISODate(event.end_date) })
    for (const day of days) bucket(toISODate(day)).events.push(event)
  }

  return byDate
}
