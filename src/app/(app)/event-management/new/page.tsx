import Link from 'next/link'
import { sectionGuard } from '@/lib/section-guard'
import { ChevronLeft } from 'lucide-react'
import { EventManagementForm } from '@/components/event-management/EventManagementForm'
import { createEventManagement } from '@/actions/event-management'

export default async function NewEventManagementPage() {
  const denied = await sectionGuard('agencies')
  if (denied) return denied
  return (
    <div className="max-w-xl">
      <Link href="/event-management" className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> Event Management
      </Link>
      <h1 className="mb-8 text-2xl font-bold text-gray-900">New Company</h1>
      <EventManagementForm onSubmit={createEventManagement} />
    </div>
  )
}
