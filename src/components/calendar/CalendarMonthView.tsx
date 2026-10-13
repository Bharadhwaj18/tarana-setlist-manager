'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { addMonths, subMonths, format } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { buildMonthGrid, groupItemsByDate, externalLabel, type DayItems, type ExternalItem } from '@/lib/calendar'
import { parseISODate } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { DayDetailPanel } from './DayDetailPanel'
import { KIND_DOT, KIND_DOT_SELECTED, KIND_LABEL, KIND_PILL, type CalendarKind } from './calendarStyles'
import type { Show, Unavailability, CalendarEvent } from '@/types'
import type { CalendarTask } from '@/types/tasks'

interface Member { id: string; name: string }

interface Props {
  shows: Show[]
  tasks: CalendarTask[]
  /** Boards a new task can be added to from a day (current-workspace view only). */
  boards?: { id: string; name: string }[]
  unavailability: Unavailability[]
  events: CalendarEvent[]
  /** Redacted items from the viewer's other workspaces. */
  external?: ExternalItem[]
  /** Consolidated view: no adding or deleting, items tagged with their workspace. */
  readOnly?: boolean
  workspaceNameById?: Record<string, string>
  members: Member[]
  /** profile id -> display name, resolved server-side. */
  nameById: Record<string, string>
  today: string
  /** Right side of the page header (the This workspace / All workspaces switch). */
  headerRight?: ReactNode
  /** Small explanatory line under the header. */
  note?: string
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const KINDS: CalendarKind[] = ['show', 'task', 'off', 'event', 'else']
const MAX_PILLS = 2

interface DayPill { key: string; kind: CalendarKind; label: string; done?: boolean }

const EMPTY_DAY: DayItems = { shows: [], tasks: [], unavailability: [], events: [], external: [] }

const navBtn = 'rounded-lg border border-brand-200 bg-white p-1.5 text-gray-600 transition-colors hover:bg-brand-100 hover:text-gray-900'

export function CalendarMonthView({
  shows, tasks, unavailability, events, boards = [], external = [], readOnly = false, workspaceNameById = {},
  members, nameById, today, headerRight, note,
}: Props) {
  const tag = (workspaceId: string | null, text: string) => (readOnly && workspaceId && workspaceNameById[workspaceId] ? `${workspaceNameById[workspaceId]} · ${text}` : text)
  const [currentMonth, setCurrentMonth] = useState(() => parseISODate(today))
  const [selectedDate, setSelectedDate] = useState(today)

  const weeks = useMemo(() => buildMonthGrid(currentMonth), [currentMonth])
  const byDate = useMemo(() => groupItemsByDate(shows, tasks, unavailability, events, external), [shows, tasks, unavailability, events, external])

  const pillsFor = (items: DayItems): DayPill[] => {
    const pills: DayPill[] = []
    for (const s of items.shows) pills.push({ key: `s-${s.id}`, kind: 'show', label: tag(s.workspace_id, s.title) })
    for (const t of items.tasks) pills.push({ key: `t-${t.id}`, kind: 'task', label: tag(t.workspace_id, t.title), done: !!t.completed_at })
    if (items.unavailability.length > 0) {
      pills.push({ key: 'off', kind: 'off', label: `${items.unavailability.map(u => nameById[u.member_id] ?? 'Someone').join(', ')} away` })
    }
    for (const e of items.events) pills.push({ key: `e-${e.id}`, kind: 'event', label: tag(e.workspace_id, e.title) })
    for (const x of items.external) pills.push({ key: `x-${x.key}`, kind: 'else', label: externalLabel(x, nameById) })
    return pills
  }

  const kindsFor = (items: DayItems): CalendarKind[] => {
    const present: Record<CalendarKind, boolean> = {
      show: items.shows.length > 0,
      task: items.tasks.length > 0,
      off: items.unavailability.length > 0,
      event: items.events.length > 0,
      else: items.external.length > 0,
    }
    return KINDS.filter(k => present[k])
  }

  const goToday = () => {
    setCurrentMonth(parseISODate(today))
    setSelectedDate(today)
  }
  const prev = () => setCurrentMonth(m => subMonths(m, 1))
  const next = () => setCurrentMonth(m => addMonths(m, 1))
  const monthLabel = format(currentMonth, 'MMMM yyyy')

  const selectedItems = byDate[selectedDate] ?? EMPTY_DAY
  const detailProps = { date: selectedDate, items: selectedItems, readOnly, workspaceNameById, members, boards, nameById }

  return (
    <div>
      {/* Header: month title + controls on desktop, plain title on phones */}
      <div className="mb-3 hidden items-end justify-between gap-3 md:flex">
        <div className="flex items-center gap-2.5">
          <h1 className="text-3xl font-bold text-gray-900">{monthLabel}</h1>
          <button type="button" onClick={prev} aria-label="Previous month" className={navBtn}><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={next} aria-label="Next month" className={navBtn}><ChevronRight className="h-4 w-4" /></button>
          <button type="button" onClick={goToday} className={cn(navBtn, 'px-3 py-1.5 text-sm font-bold')}>Today</button>
        </div>
        {headerRight}
      </div>
      <div className="mb-3 flex items-end justify-between gap-3 md:hidden">
        <h1 className="text-3xl font-bold text-gray-900">Calendar</h1>
        {headerRight}
      </div>
      {note && <p className="mb-3 text-sm text-gray-500">{note}</p>}

      {/* Legend (desktop) */}
      <div className="mb-3 hidden flex-wrap gap-1.5 md:flex">
        {KINDS.map(k => (
          <span key={k} className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-extrabold', KIND_PILL[k])}>{KIND_LABEL[k]}</span>
        ))}
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        {/* Desktop month: pills inside each day */}
        <div className="hidden min-w-0 flex-1 overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-sm md:block">
          <div className="grid grid-cols-7 border-b border-brand-100 bg-brand-50">
            {WEEKDAYS.map(label => (
              <div key={label} className="py-2 text-center text-[11px] font-extrabold uppercase tracking-[0.1em] text-gray-500">{label}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {weeks.flat().map(day => {
              const items = byDate[day.date]
              const isToday = day.date === today
              const isSelected = day.date === selectedDate
              const pills = items ? pillsFor(items) : []
              const hidden = pills.length - MAX_PILLS
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDate(day.date)}
                  aria-label={parseISODate(day.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                  aria-pressed={isSelected}
                  className={cn(
                    'flex h-[5.5rem] min-w-0 flex-col items-stretch gap-1 overflow-hidden border-b border-r border-brand-100 p-1.5 text-left transition-colors hover:bg-brand-50 [&:nth-child(7n)]:border-r-0',
                    !day.inCurrentMonth && 'bg-gray-50/70',
                    isSelected && 'bg-brand-50 ring-2 ring-inset ring-brand-400'
                  )}
                >
                  <span className={cn(
                    'flex h-[22px] w-[22px] shrink-0 items-center justify-center self-start rounded-full text-xs font-bold',
                    isToday ? 'bg-brand-400 text-white' : day.inCurrentMonth ? 'text-gray-700' : 'text-gray-300'
                  )}>
                    {parseISODate(day.date).getDate()}
                  </span>
                  {pills.slice(0, MAX_PILLS).map(p => (
                    <span
                      key={p.key}
                      className={cn(
                        'truncate rounded px-1.5 py-px text-[10px] font-bold',
                        !day.inCurrentMonth ? 'bg-gray-100 text-gray-400' : isSelected && p.kind === 'show' ? 'bg-hero text-hero-fg' : KIND_PILL[p.kind],
                        p.done && 'line-through opacity-60'
                      )}
                    >
                      {p.label}
                    </span>
                  ))}
                  {hidden > 0 && <span className="px-1 text-[10px] font-bold text-gray-400">+{hidden} more</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* Phone month: dots under each day, the agenda below */}
        <div className="rounded-2xl border border-brand-200 bg-white px-2 pb-2 pt-2.5 shadow-sm md:hidden">
          <div className="flex items-center justify-between px-2.5 pb-2">
            <h2 className="font-display text-lg font-bold text-gray-900">{monthLabel}</h2>
            <div className="flex items-center gap-1">
              <button type="button" onClick={prev} aria-label="Previous month" className="rounded-lg p-1.5 text-gray-600 hover:bg-brand-100"><ChevronLeft className="h-5 w-5" /></button>
              <button type="button" onClick={goToday} className="rounded-lg px-2 py-1 text-xs font-bold text-gray-600 hover:bg-brand-100">Today</button>
              <button type="button" onClick={next} aria-label="Next month" className="rounded-lg p-1.5 text-gray-600 hover:bg-brand-100"><ChevronRight className="h-5 w-5" /></button>
            </div>
          </div>
          <div className="grid grid-cols-7">
            {WEEKDAYS.map(label => (
              <div key={label} className="pb-1 text-center text-[10px] font-extrabold text-gray-400">{label[0]}</div>
            ))}
            {weeks.flat().map(day => {
              const items = byDate[day.date]
              const isToday = day.date === today
              const isSelected = day.date === selectedDate
              const kinds = items ? kindsFor(items) : []
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDate(day.date)}
                  aria-label={parseISODate(day.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                  aria-pressed={isSelected}
                  className={cn(
                    'm-px flex h-11 flex-col items-center justify-center gap-0.5 rounded-xl transition-colors',
                    isSelected ? 'bg-hero text-hero-fg' : 'hover:bg-brand-50'
                  )}
                >
                  <span className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-[13px] font-bold',
                    isSelected ? 'text-hero-fg' : isToday ? 'bg-brand-400 text-white' : day.inCurrentMonth ? 'text-gray-700' : 'text-gray-300'
                  )}>
                    {parseISODate(day.date).getDate()}
                  </span>
                  <span className="flex h-[5px] gap-0.5">
                    {kinds.slice(0, 4).map(k => (
                      <span key={k} className={cn('h-[5px] w-[5px] rounded-full', isSelected ? KIND_DOT_SELECTED[k] : KIND_DOT[k], !day.inCurrentMonth && !isSelected && 'opacity-50')} />
                    ))}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected day: side panel (desktop) / agenda (phone). Keyed by date so open forms reset when the day changes. */}
        <DayDetailPanel key={`panel-${selectedDate}`} layout="panel" className="hidden w-[17rem] shrink-0 md:block" {...detailProps} />
        <DayDetailPanel key={`agenda-${selectedDate}`} layout="agenda" className="md:hidden" {...detailProps} />
      </div>
    </div>
  )
}
