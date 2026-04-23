import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { SongForm } from '@/components/songs/SongForm'
import { updateSong } from '@/actions/songs'
import type { SongFormData } from '@/lib/validators'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}

export default async function EditSongPage({ params, searchParams }: Props) {
  const { id } = await params
  const { from } = await searchParams
  const supabase = await createClient()
  const { data: song } = await supabase.from('songs').select('*').eq('id', id).single()

  if (!song) notFound()

  const handleUpdate = async (data: SongFormData) => {
    'use server'
    const backTo = from ? `/songs/${id}?from=${encodeURIComponent(from)}` : `/songs/${id}`
    await updateSong(id, data, backTo)
  }

  const backHref = from
    ? `/songs/${id}?from=${encodeURIComponent(from)}`
    : `/songs/${id}`

  return (
    <div className="max-w-2xl">
      <Link href={backHref} className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> {song.title}
      </Link>
      <h1 className="mb-8 text-2xl font-bold text-gray-900">Edit Song</h1>
      <SongForm song={song} onSubmit={handleUpdate} />
    </div>
  )
}
