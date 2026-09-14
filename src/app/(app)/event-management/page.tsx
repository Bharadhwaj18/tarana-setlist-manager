import Link from 'next/link'
import { Plus, Building2 } from 'lucide-react'
import { getCachedEventManagementCompanies, getCachedShows } from '@/lib/data'
import { Button } from '@/components/ui/Button'
import { EventManagementSearchList } from '@/components/event-management/EventManagementSearchList'

export default async function EventManagementPage() {
  const [companies, shows] = await Promise.all([
    getCachedEventManagementCompanies(),
    getCachedShows(),
  ])

  const showCountByCompany: Record<string, number> = {}
  for (const s of shows) {
    if (!s.event_management_id) continue
    showCountByCompany[s.event_management_id] = (showCountByCompany[s.event_management_id] ?? 0) + 1
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Event Management</h1>
          <p className="mt-1 text-sm text-gray-500">{companies.length} agenc{companies.length !== 1 ? 'ies' : 'y'} — companies private shows get booked through</p>
        </div>
        <Button asChild>
          <Link href="/event-management/new"><Plus className="h-4 w-4" /> New Company</Link>
        </Button>
      </div>

      {!companies.length ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-gray-200 py-20 text-center">
          <Building2 className="h-12 w-12 text-gray-300" />
          <div>
            <p className="font-medium text-gray-500">No agencies yet</p>
            <p className="text-sm text-gray-400">Add one when a private show comes in through a booking agency, not a direct client</p>
          </div>
          <Button asChild>
            <Link href="/event-management/new"><Plus className="h-4 w-4" /> Add a company</Link>
          </Button>
        </div>
      ) : (
        <EventManagementSearchList companies={companies} showCountByCompany={showCountByCompany} />
      )}
    </div>
  )
}
