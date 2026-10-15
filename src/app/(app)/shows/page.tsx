import Link from 'next/link'
import { sectionGuard } from '@/lib/section-guard'
import { Plus, CalendarDays } from 'lucide-react'
import { getCachedShows, getCachedShowTransactions, getCachedSetlistsByShow, getCachedEventManagementCompanies, getCachedFinanceSettings } from '@/lib/data'
import { formatMoney } from '@/lib/finance/settings'
import { todayISO, isUpcoming, canonicalCity } from '@/lib/shows'
import { Button } from '@/components/ui/Button'
import { ShowSearchList } from '@/components/shows/ShowSearchList'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionLabel } from '@/components/ui/SectionLabel'

export default async function ShowsPage() {
  const denied = await sectionGuard('shows')
  if (denied) return denied
  const [shows, txns, setlists, eventManagementCompanies] = await Promise.all([
    getCachedShows(),
    getCachedShowTransactions(),
    getCachedSetlistsByShow(),
    getCachedEventManagementCompanies(),
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
  const eventManagementById: Record<string, { id: string; name: string }> = {}
  for (const c of eventManagementCompanies) {
    eventManagementById[c.id] = { id: c.id, name: c.name }
  }

  // Dashboard stats — "played" means already happened (or undated legacy
  // entries), same rule as the Upcoming Shows split: nothing booked for the
  // future counts as something the band has actually played yet.
  const played = shows.filter(s => !isUpcoming(s.show_date, today))
  const totalRevenue = played.reduce((sum, s) => sum + (netByShow[s.id] ?? 0), 0)
  const thisYear = today.slice(0, 4)
  const playedThisYear = played.filter(s => s.show_date?.startsWith(thisYear)).length
  const waitingToSplit = played.filter(s => !s.split_at && (netByShow[s.id] ?? 0) > 0).length
  const upcomingCount = shows.length - played.length

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
  // for a few others — grouped by canonical city, folding known spelling
  // variants (Bangalore/Bengaluru/the odd typo all count as one city).
  const cityCounts: Record<string, number> = {}
  for (const s of played) {
    const venue = s.venue?.trim()
    if (!venue) continue
    const city = canonicalCity(venue)
    cityCounts[city] = (cityCounts[city] ?? 0) + 1
  }
  const topCities = Object.entries(cityCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  const stats = [
    { label: 'This year', value: `${playedThisYear} show${playedThisYear === 1 ? '' : 's'}` },
    { label: 'Earned, all time', value: formatMoney(totalRevenue, (await getCachedFinanceSettings()).currency) },
    { label: 'Waiting to split', value: `${waitingToSplit} show${waitingToSplit === 1 ? '' : 's'}`, alert: waitingToSplit > 0 },
  ]

  return (
    <div>
      <PageHeader
        title="Shows"
        subtitle={`${upcomingCount} coming up · ${played.length} played`}
        action={
          <Button asChild>
            <Link href="/shows/new"><Plus className="h-4 w-4" /> New show</Link>
          </Button>
        }
      />

      {played.length > 0 && (
        <div className="mb-5 grid grid-cols-3 divide-x divide-brand-200 rounded-2xl border border-brand-200 bg-white shadow-sm">
          {stats.map(st => (
            <div key={st.label} className="min-w-0 px-3 py-3 sm:px-5">
              <SectionLabel className="truncate !text-[10px] sm:!text-[11px]">{st.label}</SectionLabel>
              <p className={`mt-1 truncate font-display text-lg font-bold sm:text-2xl ${st.alert ? 'text-red-600' : 'text-gray-900'}`}>{st.value}</p>
            </div>
          ))}
        </div>
      )}

      {!shows.length ? (
        <EmptyState
          icon={<CalendarDays className="h-12 w-12" />}
          title="No shows yet"
          description="Add a show, then build its setlist and log its finances from here"
          action={<Button asChild><Link href="/shows/new"><Plus className="h-4 w-4" /> Add a show</Link></Button>}
        />
      ) : (
        <ShowSearchList
          shows={shows} netByShow={netByShow} setlistByShow={setlistByShow} today={today}
          eventManagementById={eventManagementById}
          insights={{ formatBreakdown, revenueByFormat, showsPerYear, topCities }}
        />
      )}
    </div>
  )
}
