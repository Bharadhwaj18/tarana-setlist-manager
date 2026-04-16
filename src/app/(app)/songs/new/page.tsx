import { SongForm } from '@/components/songs/SongForm'
import { createSong } from '@/actions/songs'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default function NewSongPage() {
  return (
    <div className="max-w-2xl">
      <Link href="/songs" className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> Songs
      </Link>
      <h1 className="mb-8 text-2xl font-bold text-gray-900">New Song</h1>
      <SongForm onSubmit={createSong} />
    </div>
  )
}
