import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getCachedShow } from '@/lib/data'
import { ShowForm } from '@/components/shows/ShowForm'
import { updateShow } from '@/actions/shows'
import type { ShowFormData } from '@/lib/validators'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditShowPage({ params }: Props) {
  const { id } = await params
  const show = await getCachedShow(id)
  if (!show) notFound()

  // A plain closure over `id` isn't serializable across the server/client
  // boundary — has to be its own inline server action, same as the
  // setlist edit page's handleUpdate.
  const handleUpdate = async (data: ShowFormData) => {
    'use server'
    return updateShow(id, data)
  }

  return (
    <div className="max-w-xl">
      <Link href={`/shows/${id}`} className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> {show.title}
      </Link>
      <h1 className="mb-8 text-2xl font-bold text-gray-900">Edit Show</h1>
      <ShowForm show={show} onSubmit={handleUpdate} />
    </div>
  )
}
