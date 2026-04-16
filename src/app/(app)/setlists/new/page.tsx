import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { SetlistForm } from '@/components/setlists/SetlistForm'
import { createSetlist } from '@/actions/setlists'

export default function NewSetlistPage() {
  return (
    <div className="max-w-xl">
      <Link href="/setlists" className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> Setlists
      </Link>
      <h1 className="mb-8 text-2xl font-bold text-gray-900">New Setlist</h1>
      <SetlistForm onSubmit={createSetlist} />
    </div>
  )
}
