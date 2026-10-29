'use client'

import { useMemo, useRef, useState, type ReactNode, type TouchEvent } from 'react'
import { addMonths, subMonths, format } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { buildMonthGrid, groupItemsByDate, externalLabel, type DayItems, type ExternalItem } from '@/lib/calendar'
import { parseISODate } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { DayDetailPanel } from './DayDetailPanel'
import { KIND_LABEL, KIND_PILL, type CalendarKind } from './calendarStyles'
import { SquareCheck } from 'lucide-react'
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

  // Phone cells: markers for what kinds of thing are on, and the name of the most important one.
  const phoneDay = (items: DayItems | undefined) => {
    if (!items) return null
    const count = items.shows.length + items.events.length + items.tasks.length + (items.unavailability.length > 0 ? 1 : 0) + items.external.length
    if (count === 0) return null
    const first: { kind: CalendarKind; label: string } | null =
      items.shows[0] ? { kind: 'show', label: items.shows[0].title }
        : items.events[0] ? { kind: 'event', label: items.events[0].title }
          : items.tasks[0] ? { kind: 'task', label: items.tasks[0].title }
            : items.unavailability.length > 0 ? { kind: 'off', label: 'Away' }
              : items.external.length > 0 ? { kind: 'else', label: 'Busy' } : null
    return {
      show: items.shows.length > 0,
      event: items.events.length > 0,
      task: items.tasks.some(t => !t.completed_at),
      away: items.unavailability.length > 0,
      elsewhere: items.external.length > 0,
      first,
      more: count - 1,
    }
  }

  // Which side the new month slides in from, and how far a finger is currently dragging the month.
  const [slideFrom, setSlideFrom] = useState<'left' | 'right' | null>(null)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const touch = useRef<{ x: number; y: number; axis: 'x' | 'y' | null } | null>(null)

  const goToday = () => {
    const target = parseISODate(today)
    setSlideFrom(target < currentMonth ? 'left' : target > currentMonth ? 'right' : null)
    setCurrentMonth(target)
    setSelectedDate(today)
  }
  const prev = () => { setSlideFrom('left'); setCurrentMonth(m => subMonths(m, 1)) }
  const next = () => { setSlideFrom('right'); setCurrentMonth(m => addMonths(m, 1)) }
  const monthLabel = format(currentMonth, 'MMMM yyyy')
  const slideClass = slideFrom === 'right' ? 'cal-from-right' : slideFrom === 'left' ? 'cal-from-left' : ''

  // The month follows the finger sideways; past the threshold it changes, otherwise it springs back.
  const SWIPE_AT = 60
  const swipe = {
    onTouchStart: (e: TouchEvent) => {
      const t = e.touches[0]
      touch.current = e.touches.length === 1 ? { x: t.clientX, y: t.clientY, axis: null } : null
    },
    onTouchMove: (e: TouchEvent) => {
      const s0 = touch.current
      if (!s0) return
      const t = e.touches[0]
      const dx = t.clientX - s0.x
      const dy = t.clientY - s0.y
      if (!s0.axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) s0.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y'
      if (s0.axis !== 'x') return
      setDragging(true)
      setDragX(dx * 0.85)
    },
    onTouchEnd: (e: TouchEvent) => {
      const s0 = touch.current
      touch.current = null
      setDragging(false)
      if (!s0 || s0.axis !== 'x') { setDragX(0); return }
      const dx = e.changedTouches[0].clientX - s0.x
      setDragX(0)
      if (dx <= -SWIPE_AT) next()
      else if (dx >= SWIPE_AT) prev()
    },
  }

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
          <div key={monthLabel} className={cn('grid grid-cols-7', slideClass)}>
            {weeks.flat().map(day => {
              const items = byDate[day.date]
              const isToday = day.date === today
              const isSelected = day.date === selectedDate
              const pills = items ? pillsFor(items) : []
              const away = !!items && items.unavailability.length > 0
              const hidden = pills.length - MAX_PILLS
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDate(day.date)}
                  aria-label={parseISODate(day.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                  aria-pressed={isSelected}
                  className={cn(
                    'active:scale-[0.97] flex h-[5.5rem] min-w-0 flex-col items-stretch gap-1 overflow-hidden border-b border-r border-brand-100 p-1.5 text-left transition-colors hover:bg-brand-50 [&:nth-child(7n)]:border-r-0',
                    !day.inCurrentMonth && 'bg-gray-50/70',
                    // Someone away: the whole day goes red, so it can't be missed.
                    away && day.inCurrentMonth && 'ring-1 ring-inset ring-red-300',
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
        <div {...swipe} className="touch-pan-y overflow-hidden rounded-2xl border border-brand-200 bg-white px-2 pb-2 pt-2.5 shadow-sm md:hidden">
          <div className="flex items-center justify-between px-2.5 pb-2">
            <h2 key={monthLabel} className={cn('font-display text-lg font-bold text-gray-900', slideClass)}>{monthLabel}</h2>
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
          </div>
          <div
            style={{ transform: dragX ? `translateX(${dragX}px)` : undefined, opacity: dragX ? Math.max(0.4, 1 - Math.abs(dragX) / 400) : undefined }}
            className={cn(!dragging && 'transition-[transform,opacity] duration-200 ease-out')}
          >
          <div key={monthLabel} className={cn('grid grid-cols-7', slideClass)}>
            {weeks.flat().map(day => {
              const items = byDate[day.date]
              const isToday = day.date === today
              const isSelected = day.date === selectedDate
              const d = phoneDay(items)
              const pillTone: Record<CalendarKind, string> = {
                show: 'bg-brand-100 text-brand-700',
                event: 'bg-amber-100 text-amber-800',
                task: 'bg-sky-100 text-sky-800',
                off: 'bg-transparent text-red-700',
                else: 'bg-white text-gray-500',
              }
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDate(day.date)}
                  aria-label={`${parseISODate(day.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}${d?.first ? `: ${d.first.label}${d.more ? ` and ${d.more} more` : ''}` : ''}`}
                  aria-pressed={isSelected}
                  className={cn('relative m-px flex h-[4.25rem] min-w-0 flex-col items-center rounded-xl pt-1 transition-colors', !isSelected && 'hover:bg-brand-50', !day.inCurrentMonth && 'opacity-40')}
                >
                  {/* Background: selected, someone away (striped) or busy in another workspace (dashed). */}
                  <span aria-hidden="true" className={cn('absolute inset-0 rounded-xl',
                    isSelected ? 'bg-hero' : d?.elsewhere ? 'border-[1.5px] border-dashed border-gray-400' : '',
                    d?.away && !isSelected && 'ring-1 ring-inset ring-red-300')} />
                  <span className={cn('relative flex h-[26px] w-[26px] items-center justify-center rounded-lg text-[13px] font-extrabold',
                    d?.show ? (isSelected ? 'bg-hero-fg text-hero' : 'bg-brand-400 text-white')
                      : isSelected ? 'text-hero-fg' : 'text-gray-800',
                    isToday && !d?.show && (isSelected ? 'ring-2 ring-hero-fg' : 'ring-2 ring-brand-400'))}>
                    {parseISODate(day.date).getDate()}
                  </span>
                  <span aria-hidden="true" className="relative mt-0.5 flex h-2 items-center gap-[3px]">
                    {d?.event && <span className={cn('h-[3px] w-3 rounded-full', isSelected ? 'bg-hero-fg' : 'bg-amber-500')} />}
                    {d?.task && <SquareCheck className={cn('h-2.5 w-2.5', isSelected ? 'text-hero-fg' : 'text-sky-600')} strokeWidth={3} />}
                  </span>
                  {d?.first && (
                    <span aria-hidden="true" className="relative flex w-full min-w-0 items-center justify-center gap-px px-0.5 pt-px">
                      <span className={cn('min-w-0 truncate rounded-full px-1 text-[9px] font-extrabold leading-[1.45]', isSelected ? 'bg-white/20 text-hero-fg' : pillTone[d.first.kind])}>
                        {d.first.label}
                      </span>
                      {d.more > 0 && <span className={cn('shrink-0 text-[8px] font-extrabold', isSelected ? 'text-hero-fg' : 'text-gray-500')}>+{d.more}</span>}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          </div>
          <div aria-hidden="true" className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-brand-100 px-2 pt-2 text-[11px] font-bold text-gray-500">
            <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded bg-brand-400" />Show</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-[3px] w-3 rounded-full bg-amber-500" />Event</span>
            <span className="inline-flex items-center gap-1.5"><SquareCheck className="h-3 w-3 text-sky-600" strokeWidth={3} />Task due</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded ring-1 ring-inset ring-red-300" />Away</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded border-[1.5px] border-dashed border-gray-400" />Busy elsewhere</span>
          </div>
        </div>

        {/* Selected day: side panel (desktop) / agenda (phone). Keyed by date so open forms reset when the day changes. */}
        <DayDetailPanel key={`panel-${selectedDate}`} layout="panel" className="hidden w-[17rem] shrink-0 md:block" {...detailProps} />
        <DayDetailPanel key={`agenda-${selectedDate}`} layout="agenda" className="md:hidden" {...detailProps} />
      </div>
    </div>
  )
}
