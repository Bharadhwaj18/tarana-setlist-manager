'use client'

import { useMemo, useState } from 'react'
import { addMonths, subMonths, format } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { buildMonthGrid, groupItemsByDate, externalLabel, type ExternalItem } from '@/lib/calendar'
import { parseISODate } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { DayDetailPanel } from './DayDetailPanel'
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
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function CalendarMonthView({ shows, tasks, unavailability, events, boards = [], external = [], readOnly = false, workspaceNameById = {}, members, nameById, today }: Props) {
  const tag = (workspaceId: string | null, text: string) => (readOnly && workspaceId && workspaceNameById[workspaceId] ? `${workspaceNameById[workspaceId]} · ${text}` : text)
  const [currentMonth, setCurrentMonth] = useState(() => parseISODate(today))
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const weeks = useMemo(() => buildMonthGrid(currentMonth), [currentMonth])
  const byDate = useMemo(() => groupItemsByDate(shows, tasks, unavailability, events, external), [shows, tasks, unavailability, events, external])

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">{format(currentMonth, 'MMMM yyyy')}</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCurrentMonth(m => subMonths(m, 1))}
            aria-label="Previous month"
            className="rounded-md p-1.5 text-gray-500 hover:bg-brand-100 hover:text-gray-900"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentMonth(m => addMonths(m, 1))}
            aria-label="Next month"
            className="rounded-md p-1.5 text-gray-500 hover:bg-brand-100 hover:text-gray-900"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-col overflow-hidden rounded-xl border border-brand-200">
        <div className="grid shrink-0 grid-cols-7 border-b border-brand-200 bg-brand-50">
          {WEEKDAY_LABELS.map(label => (
            <div key={label} className="px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-500 sm:py-2 sm:text-sm">
              {label}
            </div>
          ))}
        </div>
        {/* Phones get a grid that fills most of the viewport (auto-rows-fr
            splits the fixed height evenly across however many week-rows this
            month has) instead of shrink-wrapping to content, which used to
            leave the calendar looking cramped under a lot of empty page.
            Desktop rows instead get an explicit min-height per cell (below)
            — about 20% larger than before — since content there already
            drives row height via auto-rows-auto rather than a fixed
            container. */}
        <div className="grid h-[calc((100dvh-230px)*0.84)] min-h-[353px] auto-rows-fr grid-cols-7 sm:h-auto sm:min-h-0 sm:auto-rows-auto">
          {weeks.flat().map(day => {
            const items = byDate[day.date]
            const isToday = day.date === today
            return (
              <button
                key={day.date}
                type="button"
                onClick={() => setSelectedDate(day.date)}
                className={cn(
                  'flex min-h-0 flex-col items-start gap-1 overflow-hidden border-b border-r border-brand-100 p-1 text-left transition-colors last:border-r-0 hover:bg-brand-100 sm:min-h-[5.5rem] sm:p-2',
                  !day.inCurrentMonth && 'bg-gray-50/60 text-gray-300'
                )}
              >
                <span className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium sm:h-7 sm:w-7 sm:text-sm',
                  isToday ? 'bg-brand-400 text-white' : day.inCurrentMonth ? 'text-gray-700' : 'text-gray-300'
                )}>
                  {parseISODate(day.date).getDate()}
                </span>

                {items && (
                  <div className="flex w-full min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                    {items.shows.slice(0, 2).map(s => (
                      <span key={s.id} className="truncate rounded bg-brand-100 px-1 py-0.5 text-[9px] font-medium text-brand-700 sm:text-[11px]">{tag(s.workspace_id, s.title)}</span>
                    ))}
                    {items.tasks.slice(0, 2).map(t => (
                      <span key={t.id} className={cn('truncate rounded bg-violet-100 px-1 py-0.5 text-[9px] font-medium text-violet-700 sm:text-[11px]', t.completed_at && 'line-through opacity-60')}>{tag(t.workspace_id, t.title)}</span>
                    ))}
                    {items.unavailability.length > 0 && (
                      <span className="truncate rounded bg-gray-100 px-1 py-0.5 text-[9px] font-medium text-gray-500 sm:text-[11px]">
                        {items.unavailability.map(u => nameById[u.member_id] ?? 'Someone').join(', ')} unavailable
                      </span>
                    )}
                    {items.events.slice(0, 2).map(e => (
                      <span key={e.id} className="truncate rounded bg-amber-100 px-1 py-0.5 text-[9px] font-medium text-amber-700 sm:text-[11px]">{tag(e.workspace_id, e.title)}</span>
                    ))}
                    {items.external.slice(0, 2).map(x => (
                      <span key={x.key} className="truncate rounded border border-dashed border-gray-300 px-1 py-0.5 text-[9px] font-medium text-gray-500 sm:text-[11px]">{externalLabel(x, nameById)}</span>
                    ))}
                    {(items.shows.length + items.tasks.length + items.events.length + items.external.length) > 4 && (
                      <span className="text-[9px] text-gray-400 sm:text-[11px]">+more</span>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {selectedDate && (
        <DayDetailPanel
          date={selectedDate}
          items={byDate[selectedDate] ?? { shows: [], tasks: [], unavailability: [], events: [], external: [] }}
          readOnly={readOnly}
          workspaceNameById={workspaceNameById}
          members={members}
          boards={boards}
          nameById={nameById}
          open={!!selectedDate}
          onOpenChange={open => { if (!open) setSelectedDate(null) }}
        />
      )}
    </div>
  )
}
