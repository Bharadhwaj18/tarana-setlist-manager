import Link from 'next/link'
import { Plus, CalendarDays } from 'lucide-react'
import { getCachedShows, getCachedShowTransactions, getCachedSetlistsByShow } from '@/lib/data'
import { todayISO, isUpcoming } from '@/lib/shows'
import { Button } from '@/components/ui/Button'
import { ShowSearchList } from '@/components/shows/ShowSearchList'
import { ShowsDashboard } from '@/components/shows/ShowsDashboard'

export default async function ShowsPage() {
  const [shows, txns, setlists] = await Promise.all([
    getCachedShows(),
    getCachedShowTransactions(),
    getCachedSetlistsByShow(),
  ])
  const today = todayISO()

  const netByShow: Record<string, number> = {}
  for (const t of txns) {
    if (!t.show_id) continue
    netByShow[t.show_id] = (netByShow[t.show_id] ?? 0) + t.amount
  }
  const setlistByShow: Record<string, { id: string; title: string } | undefined> = {}
  for (const s of setlists) {
    if (s.show_id) setlistByShow[s.show_id] = { id: s.id, title: s.title }
  }

  // Dashboard stats — "played" means already happened (or undated legacy
  // entries), same rule as the Upcoming Shows split: nothing booked for the
  // future counts as something the band has actually played yet.
  const played = shows.filter(s => !isUpcoming(s.show_date, today))
  const totalRevenue = played.reduce((sum, s) => sum + (netByShow[s.id] ?? 0), 0)

  const formatCounts: Record<string, number> = {}
  const formatRevenue: Record<string, number> = {}
  for (const s of played) {
    const key = s.format ?? 'Untagged'
    formatCounts[key] = (formatCounts[key] ?? 0) + 1
    formatRevenue[key] = (formatRevenue[key] ?? 0) + (netByShow[s.id] ?? 0)
  }
  const formatBreakdown = Object.entries(formatCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
  const revenueByFormat = Object.entries(formatRevenue)
    .filter(([, value]) => value > 0)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)

  const yearCounts: Record<string, number> = {}
  for (const s of played) {
    if (!s.show_date) continue
    const year = s.show_date.slice(0, 4)
    yearCounts[year] = (yearCounts[year] ?? 0) + 1
  }
  const showsPerYear = Object.entries(yearCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => a.label.localeCompare(b.label))

  // venue holds a city for most bulk-imported shows, a specific venue name
  // for a few others — grouped case-insensitively (typos/spelling variants
  // like "Bangalore" vs "Bengaluru" are kept as separate entries, not merged).
  const cityCounts: Record<string, number> = {}
  const cityDisplay: Record<string, string> = {}
  for (const s of played) {
    const venue = s.venue?.trim()
    if (!venue) continue
    const key = venue.toLowerCase()
    cityCounts[key] = (cityCounts[key] ?? 0) + 1
    cityDisplay[key] ??= venue
  }
  const topCities = Object.entries(cityCounts)
    .map(([key, count]) => ({ label: cityDisplay[key], count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shows</h1>
          <p className="mt-1 text-sm text-gray-500">{shows.length} show{shows.length !== 1 ? 's' : ''} — the base record for setlists and finance, latest first</p>
        </div>
        <Button asChild>
          <Link href="/shows/new"><Plus className="h-4 w-4" /> New Show</Link>
        </Button>
      </div>

      <ShowsDashboard
        totalPlayed={played.length}
        totalRevenue={totalRevenue}
        formatBreakdown={formatBreakdown}
        revenueByFormat={revenueByFormat}
        showsPerYear={showsPerYear}
        topCities={topCities}
      />

      {!shows.length ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-gray-200 py-20 text-center">
          <CalendarDays className="h-12 w-12 text-gray-300" />
          <div>
            <p className="font-medium text-gray-500">No shows yet</p>
            <p className="text-sm text-gray-400">Add a show, then build its setlist and log its finances from here</p>
          </div>
          <Button asChild>
            <Link href="/shows/new"><Plus className="h-4 w-4" /> Add a show</Link>
          </Button>
        </div>
      ) : (
        <ShowSearchList shows={shows} netByShow={netByShow} setlistByShow={setlistByShow} today={today} />
      )}
    </div>
  )
}
