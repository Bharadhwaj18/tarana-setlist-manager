import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { ImportWizard } from '@/components/finance/ImportWizard'

export default function ImportPage() {
  return (
    <div className="max-w-2xl">
      <Link href="/finance" className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> Finance
      </Link>
      <ImportWizard />
    </div>
  )
}
