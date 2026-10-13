import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { ShowForm } from '@/components/shows/ShowForm'
import { createShow } from '@/actions/shows'
import { getCachedEventManagementCompanies } from '@/lib/data'

interface Props {
  searchParams: Promise<{ date?: string }>
}

export default async function NewShowPage({ searchParams }: Props) {
  const [eventManagementCompanies, { date }] = await Promise.all([
    getCachedEventManagementCompanies(),
    searchParams,
  ])

  return (
    <div className="max-w-3xl">
      <Link href="/shows" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> Shows
      </Link>
      <h1 className="mb-6 text-3xl font-bold text-gray-900">New show</h1>
      <ShowForm eventManagementCompanies={eventManagementCompanies} onSubmit={createShow} initialDate={date} />
    </div>
  )
}
