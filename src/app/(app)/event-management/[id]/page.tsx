import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Pencil, Phone, Mail, User, CalendarDays, MapPin } from 'lucide-react'
import { getCachedEventManagementCompany, getCachedShows } from '@/lib/data'
import { Button } from '@/components/ui/Button'
import { DeleteEventManagementButton } from '@/components/event-management/DeleteEventManagementButton'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EventManagementDetailPage({ params }: Props) {
  const { id } = await params
  const [company, shows] = await Promise.all([
    getCachedEventManagementCompany(id),
    getCachedShows(),
  ])

  if (!company) notFound()

  const bookedShows = shows.filter(s => s.event_management_id === id)

  return (
    <div className="max-w-2xl">
      <Link href="/event-management" className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> Event Management
      </Link>

      <div className="mb-6 flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
          {company.base_location && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500"><MapPin className="h-4 w-4" />{company.base_location}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" asChild>
            <Link href={`/event-management/${id}/edit`}><Pencil className="h-4 w-4" /> Edit</Link>
          </Button>
          <DeleteEventManagementButton id={id} />
        </div>
      </div>

      <section className="mb-5 rounded-xl border border-brand-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Contact</h2>
        {company.contact_name || company.contact_phone || company.contact_email ? (
          <dl className="space-y-2 text-sm">
            {company.contact_name && (
              <div className="flex items-center gap-2"><User className="h-4 w-4 text-gray-400" /><dd className="font-medium text-gray-800">{company.contact_name}</dd></div>
            )}
            {company.contact_phone && (
              <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-gray-400" /><dd className="font-medium text-gray-800">{company.contact_phone}</dd></div>
            )}
            {company.contact_email && (
              <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-gray-400" /><dd className="font-medium text-gray-800">{company.contact_email}</dd></div>
            )}
          </dl>
        ) : (
          <p className="text-sm text-gray-400">No contact details yet.</p>
        )}
      </section>

      {company.notes && (
        <section className="mb-5 rounded-xl border border-brand-200 bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Notes</h2>
          <p className="whitespace-pre-wrap text-sm text-gray-700">{company.notes}</p>
        </section>
      )}

      <section className="rounded-xl border border-brand-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Shows booked through {company.name} ({bookedShows.length})
        </h2>
        {bookedShows.length === 0 ? (
          <p className="text-sm text-gray-400">No shows linked to this agency yet.</p>
        ) : (
          <div className="space-y-2">
            {bookedShows.map(s => {
              const date = s.show_date
                ? new Date(s.show_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : null
              return (
                <Link
                  key={s.id}
                  href={`/shows/${s.id}`}
                  className="flex items-center justify-between rounded-lg bg-brand-50 px-4 py-3 text-sm hover:bg-brand-100"
                >
                  <div>
                    <p className="font-medium text-gray-800">{s.title}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-gray-500">
                      {date && <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{date}</span>}
                      {s.venue && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{s.venue}</span>}
                    </div>
                  </div>
                  {s.booking_status && (
                    <span className="shrink-0 rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-gray-600">{s.booking_status}</span>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
