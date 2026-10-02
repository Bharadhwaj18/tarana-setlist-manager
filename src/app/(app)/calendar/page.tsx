import Link from 'next/link'
import { getCachedShows, getCachedTaskData, getCachedUnavailability, getCachedCalendarEvents, getCachedAllProfiles, getCachedUser, getCachedExternalCalendar, getCachedAllCalendars } from '@/lib/data'
import { getWorkspaceContext } from '@/lib/workspace'
import { todayISO } from '@/lib/shows'
import { cn } from '@/lib/utils'
import { CalendarMonthView } from '@/components/calendar/CalendarMonthView'

const tab = 'rounded-md px-3 py-1.5 text-sm font-medium transition-colors'

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const { scope } = await searchParams
  const ctx = await getWorkspaceContext()
  const multiple = (ctx?.memberships.length ?? 0) > 1
  const all = multiple && scope === 'all'

  const { data: { user } } = await getCachedUser()
  const nameFor = (profiles: { id: string; display_name: string | null }[]) => {
    const map: Record<string, string> = {}
    for (const p of profiles) map[p.id] = p.id === user?.id ? 'You' : (p.display_name ?? 'Member')
    return map
  }

  const header = (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
        <p className="mt-1 text-sm text-gray-500">
          {all
            ? 'Everything across all your workspaces, read-only'
            : 'Shows, task deadlines, unavailability, and anything else — all in one view'}
        </p>
      </div>
      {multiple && (
        <div className="flex gap-1 rounded-lg bg-brand-100 p-1">
          <Link href="/calendar" className={cn(tab, !all ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
            This workspace
          </Link>
          <Link href="/calendar?scope=all" className={cn(tab, all ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
            All workspaces
          </Link>
        </div>
      )}
    </div>
  )

  if (all) {
    const data = await getCachedAllCalendars()
    if (!data) return null
    const nameById = nameFor(data.profiles)
    const workspaceNameById = Object.fromEntries(data.workspaces.map(w => [w.id, w.name]))
    return (
      <div className="max-w-4xl sm:max-w-5xl">
        {header}
        <CalendarMonthView
          shows={data.shows}
          tasks={data.tasks}
          unavailability={data.unavailability}
          events={data.events}
          members={[]}
          nameById={nameById}
          readOnly
          workspaceNameById={workspaceNameById}
          today={todayISO()}
        />
      </div>
    )
  }

  const [shows, taskData, unavailability, events, profiles, external] = await Promise.all([
    getCachedShows(),
    getCachedTaskData(),
    getCachedUnavailability(),
    getCachedCalendarEvents(),
    getCachedAllProfiles(),
    getCachedExternalCalendar(),
  ])

  const tasks = taskData.tasks.filter(t => t.due_date)
  const nameById = nameFor(profiles)
  const members = profiles.map(p => ({ id: p.id, name: nameById[p.id] }))

  return (
    <div className="max-w-4xl sm:max-w-5xl">
      {header}
      <CalendarMonthView
        shows={shows}
        tasks={tasks}
        boards={taskData.boards.map(b => ({ id: b.id, name: b.name }))}
        unavailability={unavailability}
        events={events}
        external={external}
        members={members}
        nameById={nameById}
        today={todayISO()}
      />
    </div>
  )
}
