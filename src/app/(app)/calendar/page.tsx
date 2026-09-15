import { getCachedShows, getCachedNotes, getCachedUnavailability, getCachedAllProfiles, getCachedUser } from '@/lib/data'
import { todayISO } from '@/lib/shows'
import { CalendarMonthView } from '@/components/calendar/CalendarMonthView'

export default async function CalendarPage() {
  const [shows, notes, unavailability, profiles, { data: { user } }] = await Promise.all([
    getCachedShows(),
    getCachedNotes(),
    getCachedUnavailability(),
    getCachedAllProfiles(),
    getCachedUser(),
  ])

  const tasks = notes.filter(n => n.due_date)

  // Sender/assignee/member names resolved server-side into plain strings —
  // never pass a resolver function to a client component.
  const nameById: Record<string, string> = {}
  for (const p of profiles) nameById[p.id] = p.id === user?.id ? 'You' : (p.display_name ?? 'Band member')

  const members = profiles.map(p => ({ id: p.id, name: nameById[p.id] }))

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
        <p className="mt-1 text-sm text-gray-500">Shows, task deadlines, and who&apos;s unavailable — all in one view</p>
      </div>
      <CalendarMonthView
        shows={shows}
        tasks={tasks}
        unavailability={unavailability}
        members={members}
        nameById={nameById}
        today={todayISO()}
      />
    </div>
  )
}
