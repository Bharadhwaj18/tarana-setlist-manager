import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getCachedEventManagementCompany } from '@/lib/data'
import { EventManagementForm } from '@/components/event-management/EventManagementForm'
import { updateEventManagement } from '@/actions/event-management'
import type { EventManagementFormData } from '@/lib/validators'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditEventManagementPage({ params }: Props) {
  const { id } = await params
  const company = await getCachedEventManagementCompany(id)
  if (!company) notFound()

  // A plain closure over `id` isn't serializable across the server/client
  // boundary — has to be its own inline server action, same as the show
  // edit page's handleUpdate.
  const handleUpdate = async (data: EventManagementFormData) => {
    'use server'
    return updateEventManagement(id, data)
  }

  return (
    <div className="max-w-xl">
      <Link href={`/event-management/${id}`} className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> {company.name}
      </Link>
      <h1 className="mb-8 text-2xl font-bold text-gray-900">Edit Company</h1>
      <EventManagementForm company={company} onSubmit={handleUpdate} />
    </div>
  )
}
