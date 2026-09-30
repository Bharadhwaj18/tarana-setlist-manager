import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns'
import { toISODate, parseISODate } from './dates'
import type { Show, Note, Unavailability, CalendarEvent } from '@/types'
import type { Database } from '@/types/database'

/** One row of the redacted cross-workspace feed (see calendar_external in the DB). */
export type ExternalItem = Database['public']['Functions']['calendar_external']['Returns'][number]

/** The same item seen through several shared members, folded into one entry. */
export interface ExternalGroup {
  key: string
  kind: ExternalItem['kind']
  memberIds: string[]
  visibility: string
  title: string | null
  detail: string | null
  sourceName: string | null
}

export function groupExternal(rows: ExternalItem[]): ExternalGroup[] {
  const byKey = new Map<string, ExternalGroup>()
  for (const r of rows) {
    const key = `${r.kind}:${r.item_id}`
    const existing = byKey.get(key)
    if (existing) {
      if (!existing.memberIds.includes(r.member_id)) existing.memberIds.push(r.member_id)
    } else {
      byKey.set(key, { key, kind: r.kind, memberIds: [r.member_id], visibility: r.visibility, title: r.title, detail: r.detail, sourceName: r.source_name })
    }
  }
  return [...byKey.values()]
}

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

export function externalLabel(group: ExternalGroup, nameById: Record<string, string>): string {
  const names = group.memberIds.map(id => nameById[id] ?? 'Someone').join(', ')
  if (group.visibility === 'details' && group.title) return `${group.title} (${names})`
  return `${names} busy`
}

export interface DayItems {
  shows: Show[]
  tasks: Note[]
  unavailability: Unavailability[]
  events: CalendarEvent[]
  /** Busy blocks / details from the viewer's other workspaces (current-workspace view only). */
  external: ExternalGroup[]
}

/**
 * Groups shows (by show_date), tasks (by due_date), unavailability, and
 * freeform events (both of the latter expanded across their whole
 * start_date..end_date range) into one YYYY-MM-DD-keyed lookup, so
 * rendering a day cell is an O(1) lookup instead of filtering every list
 * per cell.
 */
export function groupItemsByDate(shows: Show[], tasks: Note[], unavailability: Unavailability[], events: CalendarEvent[] = [], external: ExternalItem[] = []): Record<string, DayItems> {
  const byDate: Record<string, DayItems> = {}
  const bucket = (date: string) => (byDate[date] ??= { shows: [], tasks: [], unavailability: [], events: [], external: [] })

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

  const externalByDay = new Map<string, ExternalItem[]>()
  for (const row of external) {
    const days = eachDayOfInterval({ start: parseISODate(row.start_date), end: parseISODate(row.end_date) })
    for (const day of days) {
      const iso = toISODate(day)
      externalByDay.set(iso, [...(externalByDay.get(iso) ?? []), row])
    }
  }
  for (const [iso, rows] of externalByDay) bucket(iso).external = groupExternal(rows)

  return byDate
}
