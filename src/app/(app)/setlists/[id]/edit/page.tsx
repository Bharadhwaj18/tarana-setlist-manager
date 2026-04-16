import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { SetlistForm } from '@/components/setlists/SetlistForm'
import { updateSetlist } from '@/actions/setlists'
import type { SetlistFormData } from '@/lib/validators'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditSetlistPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: setlist } = await supabase.from('setlists').select('*').eq('id', id).single()

  if (!setlist) notFound()

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
    </div>
  )
}
