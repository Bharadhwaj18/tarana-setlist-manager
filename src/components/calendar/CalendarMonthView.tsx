'use client'

import { useMemo, useState } from 'react'
import { addMonths, subMonths, format } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { buildMonthGrid, groupItemsByDate } from '@/lib/calendar'
import { parseISODate } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { DayDetailPanel } from './DayDetailPanel'
import type { Show, Note, Unavailability } from '@/types'

interface Member { id: string; name: string }

interface Props {
  shows: Show[]
  tasks: Note[]
  unavailability: Unavailability[]
  members: Member[]
  /** profile id -> display name, resolved server-side. */
  nameById: Record<string, string>
  today: string
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function CalendarMonthView({ shows, tasks, unavailability, members, nameById, today }: Props) {
  const [currentMonth, setCurrentMonth] = useState(() => parseISODate(today))
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const weeks = useMemo(() => buildMonthGrid(currentMonth), [currentMonth])
  const byDate = useMemo(() => groupItemsByDate(shows, tasks, unavailability), [shows, tasks, unavailability])

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{format(currentMonth, 'MMMM yyyy')}</h2>
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
            <div key={label} className="px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-500 sm:text-xs">
              {label}
            </div>
          ))}
        </div>
        {/* Phones get a grid that fills most of the viewport (auto-rows-fr
            splits the fixed height evenly across however many week-rows this
            month has) instead of shrink-wrapping to content, which used to
            leave the calendar looking cramped under a lot of empty page. */}
        <div className="grid h-[calc(100dvh-230px)] min-h-[420px] auto-rows-fr grid-cols-7 sm:h-auto sm:min-h-0 sm:auto-rows-auto">
          {weeks.flat().map(day => {
            const items = byDate[day.date]
            const isToday = day.date === today
            return (
              <button
                key={day.date}
                type="button"
                onClick={() => setSelectedDate(day.date)}
                className={cn(
                  'flex min-h-0 flex-col items-start gap-1 overflow-hidden border-b border-r border-brand-100 p-1 text-left transition-colors last:border-r-0 hover:bg-brand-50 sm:p-2',
                  !day.inCurrentMonth && 'bg-gray-50/60 text-gray-300'
                )}
              >
                <span className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium sm:h-6 sm:w-6 sm:text-xs',
                  isToday ? 'bg-brand-400 text-white' : day.inCurrentMonth ? 'text-gray-700' : 'text-gray-300'
                )}>
                  {parseISODate(day.date).getDate()}
                </span>

                {items && (
                  <div className="flex w-full min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                    {items.shows.slice(0, 2).map(s => (
                      <span key={s.id} className="truncate rounded bg-brand-100 px-1 py-0.5 text-[9px] font-medium text-brand-700 sm:text-[10px]">{s.title}</span>
                    ))}
                    {items.tasks.slice(0, 2).map(t => (
                      <span key={t.id} className={cn('truncate rounded bg-violet-100 px-1 py-0.5 text-[9px] font-medium text-violet-700 sm:text-[10px]', t.completed_at && 'line-through opacity-60')}>{t.title}</span>
                    ))}
                    {items.unavailability.length > 0 && (
                      <span className="truncate rounded bg-gray-100 px-1 py-0.5 text-[9px] font-medium text-gray-500 sm:text-[10px]">
                        {items.unavailability.map(u => nameById[u.member_id] ?? 'Someone').join(', ')} unavailable
                      </span>
                    )}
                    {(items.shows.length + items.tasks.length) > 4 && (
                      <span className="text-[9px] text-gray-400 sm:text-[10px]">+more</span>
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
          items={byDate[selectedDate] ?? { shows: [], tasks: [], unavailability: [] }}
          members={members}
          nameById={nameById}
          open={!!selectedDate}
          onOpenChange={open => { if (!open) setSelectedDate(null) }}
        />
      )}
    </div>
  )
}
