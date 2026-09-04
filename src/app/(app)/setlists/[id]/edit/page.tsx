import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getCachedSetlistSongs, getCachedSongs } from '@/lib/data'
import { SetlistForm } from '@/components/setlists/SetlistForm'
import { SetlistTextEditor } from '@/components/setlists/SetlistTextEditor'
import { updateSetlist } from '@/actions/setlists'
import { serializeSetlistText } from '@/lib/setlist-parser'
import type { SetlistFormData } from '@/lib/validators'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditSetlistPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const [{ data: setlist }, setlistSongs, allSongs] = await Promise.all([
    supabase.from('setlists').select('*').eq('id', id).single(),
    getCachedSetlistSongs(id),
    getCachedSongs(),
  ])

  if (!setlist) notFound()

  const setlistText = serializeSetlistText(
    setlistSongs.map(ss => ({
      title: ss.song.title,
      song_key: ss.song.song_key,
      section: ss.section,
    }))
  )

  const handleUpdate = async (data: SetlistFormData) => {
    'use server'
    await updateSetlist(id, data)
  }

  return (
    <div className="max-w-xl">
      <Link href={`/setlists/${id}`} className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> {setlist.title}
      </Link>
      <h1 className="mb-8 text-2xl font-bold text-gray-900">Edit Setlist</h1>
      <SetlistForm setlist={setlist} onSubmit={handleUpdate} />

      <div className="mt-10 border-t border-brand-200 pt-8">
        <h2 className="mb-1 text-lg font-bold text-gray-900">Setlist text</h2>
        <p className="mb-4 text-sm text-gray-500">
          This is the setlist written out the same way you&apos;d paste it into Bulk Import.
          Edit it directly — delete a line that shouldn&apos;t be a section, fix the order, whatever —
          and saving rewrites the setlist to match exactly.
        </p>
        <SetlistTextEditor setlistId={id} initialText={setlistText} existingSongs={allSongs} />
      </div>
    </div>
  )
}
