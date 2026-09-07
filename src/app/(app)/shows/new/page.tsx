import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { ShowForm } from '@/components/shows/ShowForm'
import { createShow } from '@/actions/shows'

export default function NewShowPage() {
  return (
    <div className="max-w-xl">
      <Link href="/shows" className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> Shows
      </Link>
      <h1 className="mb-8 text-2xl font-bold text-gray-900">New Show</h1>
      <ShowForm onSubmit={createShow} />
    </div>
  )
}
