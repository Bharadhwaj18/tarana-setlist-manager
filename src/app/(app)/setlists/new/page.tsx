import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { SetlistForm } from '@/components/setlists/SetlistForm'
import { createSetlist } from '@/actions/setlists'
import { getCachedShow } from '@/lib/data'

interface Props {
  searchParams: Promise<{ showId?: string }>
}

export default async function NewSetlistPage({ searchParams }: Props) {
  const { showId } = await searchParams
  const show = showId ? await getCachedShow(showId) : undefined

  return (
    <div className="max-w-xl">
      <Link href={show ? `/shows/${show.id}` : '/setlists'} className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> {show ? show.title : 'Setlists'}
      </Link>
      <h1 className="mb-1 text-2xl font-bold text-gray-900">New Setlist</h1>
      {show && <p className="mb-7 text-sm text-gray-500">For the show &ldquo;{show.title}&rdquo;</p>}
      {!show && <div className="mb-7" />}
      <SetlistForm onSubmit={createSetlist} linkedShow={show ? { id: show.id, title: show.title, show_date: show.show_date, venue: show.venue } : undefined} />
    </div>
  )
}
