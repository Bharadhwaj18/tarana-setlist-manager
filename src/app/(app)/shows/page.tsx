import Link from 'next/link'
import { Plus, CalendarDays, MapPin, CheckCircle2, Circle } from 'lucide-react'
import { getCachedShows, getCachedShowTransactions, getCachedSetlistsByShow } from '@/lib/data'
import { Button } from '@/components/ui/Button'

function fmt(n: number) {
  return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export default async function ShowsPage() {
  const [shows, txns, setlists] = await Promise.all([
    getCachedShows(),
    getCachedShowTransactions(),
    getCachedSetlistsByShow(),
  ])

  const netForShow = (showId: string) =>
    txns.filter(t => t.show_id === showId).reduce((s, t) => s + t.amount, 0)
  const setlistForShow = (showId: string) => setlists.find(s => s.show_id === showId)

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shows</h1>
          <p className="mt-1 text-sm text-gray-500">{shows.length} show{shows.length !== 1 ? 's' : ''} — the base record for setlists and finance</p>
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
        <div className="space-y-2">
          {shows.map(s => {
            const isSplit = !!s.split_at
            const net = netForShow(s.id)
            const setlist = setlistForShow(s.id)
            const date = s.show_date
              ? new Date(s.show_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
              : null

            return (
              <Link
                key={s.id}
                href={`/shows/${s.id}`}
                className="flex flex-col gap-2 rounded-xl border border-brand-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-400 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-gray-900">{s.title}</p>
                    {s.tds_applicable && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">TDS</span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    {date && <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{date}</span>}
                    {s.venue && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{s.venue}</span>}
                    <span className={setlist ? 'text-green-600' : 'text-gray-400'}>
                      {setlist ? `Setlist: ${setlist.title}` : 'No setlist yet'}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-4 sm:justify-end">
                  <span className="text-sm font-bold text-gray-700">{fmt(net)}</span>
                  <span className={`flex items-center gap-1 text-xs font-medium ${isSplit ? 'text-green-600' : 'text-amber-600'}`}>
                    {isSplit ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                    {isSplit ? 'Split' : 'Unsplit'}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
