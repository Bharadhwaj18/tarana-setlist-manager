import Link from 'next/link'
import { Calendar, MapPin, ListMusic } from 'lucide-react'
import type { Setlist } from '@/types'

interface SetlistCardProps {
  setlist: Setlist
  songCount: number
}

export function SetlistCard({ setlist, songCount }: SetlistCardProps) {
  const date = setlist.show_date
    ? new Date(setlist.show_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <Link
      href={`/setlists/${setlist.id}`}
      className="group flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-indigo-300 hover:shadow-md"
    >
      <div>
        <h3 className="font-semibold text-gray-900 group-hover:text-indigo-700">{setlist.title}</h3>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-gray-400">
        {date && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" /> {date}
          </span>
        )}
        {setlist.venue && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {setlist.venue}
          </span>
        )}
        <span className="flex items-center gap-1">
          <ListMusic className="h-3 w-3" /> {songCount} {songCount === 1 ? 'song' : 'songs'}
        </span>
      </div>
    </Link>
  )
}
