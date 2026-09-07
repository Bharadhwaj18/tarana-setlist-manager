import Link from 'next/link'
import { Plus, CalendarDays } from 'lucide-react'
import { getCachedShows, getCachedShowTransactions, getCachedSetlistsByShow } from '@/lib/data'
import { Button } from '@/components/ui/Button'
import { ShowSearchList } from '@/components/shows/ShowSearchList'

export default async function ShowsPage() {
  const [shows, txns, setlists] = await Promise.all([
    getCachedShows(),
    getCachedShowTransactions(),
    getCachedSetlistsByShow(),
  ])

  const netByShow: Record<string, number> = {}
  for (const t of txns) {
    if (!t.show_id) continue
    netByShow[t.show_id] = (netByShow[t.show_id] ?? 0) + t.amount
  }
  const setlistByShow: Record<string, { id: string; title: string } | undefined> = {}
  for (const s of setlists) {
    if (s.show_id) setlistByShow[s.show_id] = { id: s.id, title: s.title }
  }

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
        <ShowSearchList shows={shows} netByShow={netByShow} setlistByShow={setlistByShow} />
      )}
    </div>
  )
}
