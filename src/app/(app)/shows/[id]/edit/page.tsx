import { notFound } from 'next/navigation'
import { sectionGuard } from '@/lib/section-guard'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getCachedShow, getCachedEventManagementCompanies } from '@/lib/data'
import { ShowForm } from '@/components/shows/ShowForm'
import { updateShow } from '@/actions/shows'
import type { ShowFormData } from '@/lib/validators'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditShowPage({ params }: Props) {
  const denied = await sectionGuard('shows')
  if (denied) return denied
  const { id } = await params
  const [show, eventManagementCompanies] = await Promise.all([
    getCachedShow(id),
    getCachedEventManagementCompanies(),
  ])
  if (!show) notFound()

  // A plain closure over `id` isn't serializable across the server/client
  // boundary — has to be its own inline server action, same as the
  // setlist edit page's handleUpdate.
  const handleUpdate = async (data: ShowFormData) => {
    'use server'
    return updateShow(id, data)
  }

  return (
    <div className="max-w-3xl">
      <Link href={`/shows/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> {show.title}
      </Link>
      <h1 className="mb-6 text-3xl font-bold text-gray-900">Edit show</h1>
      <ShowForm show={show} eventManagementCompanies={eventManagementCompanies} onSubmit={handleUpdate} />
    </div>
  )
}
