import Link from 'next/link'
import { sectionGuard } from '@/lib/section-guard'
import { getCachedShows, getCachedTaskData, getCachedUnavailability, getCachedCalendarEvents, getCachedAllProfiles, getCachedUser, getCachedExternalCalendar, getCachedAllCalendars } from '@/lib/data'
import { getWorkspaceContext } from '@/lib/workspace'
import { todayISO } from '@/lib/shows'
import { cn } from '@/lib/utils'
import { CalendarMonthView } from '@/components/calendar/CalendarMonthView'

const tab = 'rounded-lg px-3 py-1.5 text-xs font-extrabold transition-colors'

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const denied = await sectionGuard('calendar')
  if (denied) return denied
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

  const scopeToggle = multiple ? (
    <div className="flex shrink-0 rounded-xl bg-brand-100 p-1">
      <Link href="/calendar" className={cn(tab, !all ? 'bg-brand-400 text-white' : 'text-gray-700 hover:text-gray-900')}>
        <span className="md:hidden">This one</span>
        <span className="hidden md:inline">This workspace</span>
      </Link>
      <Link href="/calendar?scope=all" className={cn(tab, all ? 'bg-brand-400 text-white' : 'text-gray-700 hover:text-gray-900')}>
        <span className="md:hidden">All</span>
        <span className="hidden md:inline">All workspaces</span>
      </Link>
    </div>
  ) : undefined

  if (all) {
    const data = await getCachedAllCalendars()
    if (!data) return null
    const nameById = nameFor(data.profiles)
    const workspaceNameById = Object.fromEntries(data.workspaces.map(w => [w.id, w.name]))
    return (
      <div className="max-w-5xl">
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
          headerRight={scopeToggle}
          note="Everything across all your workspaces, read-only"
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
    <div className="max-w-5xl">
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
        headerRight={scopeToggle}
      />
    </div>
  )
}
