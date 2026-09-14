import Link from 'next/link'
import { Plus, Building2, Phone, Mail } from 'lucide-react'
import { getCachedEventManagementCompanies, getCachedShows } from '@/lib/data'
import { Button } from '@/components/ui/Button'

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
        <div className="grid gap-3 sm:grid-cols-2">
          {companies.map(c => {
            const showCount = showCountByCompany[c.id] ?? 0
            return (
              <Link
                key={c.id}
                href={`/event-management/${c.id}`}
                className="flex flex-col gap-2 rounded-xl border border-brand-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-400"
              >
                <p className="font-semibold text-gray-900">{c.name}</p>
                <div className="flex flex-col gap-1 text-xs text-gray-500">
                  {c.contact_name && <span>{c.contact_name}</span>}
                  {c.contact_phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{c.contact_phone}</span>}
                  {c.contact_email && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{c.contact_email}</span>}
                </div>
                <span className="mt-auto text-xs font-medium text-brand-600">
                  {showCount} show{showCount !== 1 ? 's' : ''} booked
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
