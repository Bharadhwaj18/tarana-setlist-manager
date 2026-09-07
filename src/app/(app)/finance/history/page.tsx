import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getCachedAllProfiles, getCachedUser } from '@/lib/data'
import { FinanceHistoryList } from '@/components/finance/FinanceHistoryList'

export default async function FinanceHistoryPage() {
  const supabase = await createClient()

  const [{ data: { user } }, profiles, { data: txns }, { data: shows }] = await Promise.all([
    getCachedUser(),
    getCachedAllProfiles(),
    // Sorted by when it was actually recorded, not the (user-editable, can
    // be backdated) `date` field — otherwise "latest at top" doesn't match
    // what you just did if any entry has a different logical date.
    supabase.from('finance_transactions').select('*').order('created_at', { ascending: false }),
    supabase.from('shows').select('*'),
  ])

  const members = profiles.map(p => ({
    id: p.id,
    name: p.id === user?.id ? 'You' : (p.display_name ?? 'Member'),
  }))

  const showTitleById = Object.fromEntries((shows ?? []).map(s => [s.id, s.title]))

  return (
    <div className="max-w-2xl">
      <Link href="/finance" className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> Finance
      </Link>
      <div className="mb-1 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">History</h1>
        <Link href="/finance/split-history" className="text-xs font-medium text-brand-600 underline underline-offset-2 hover:text-brand-800">
          Split History →
        </Link>
      </div>
      <p className="mb-6 text-sm text-gray-500">Every transaction — Misc, show income and expenses, and every split.</p>

      <FinanceHistoryList
        transactions={txns ?? []}
        members={members}
        shows={shows ?? []}
        showTitleById={showTitleById}
      />
    </div>
  )
}
