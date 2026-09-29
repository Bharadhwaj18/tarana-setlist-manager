import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspaceId } from '@/lib/workspace'
import { getCachedPendingPayments } from '@/lib/data'
import { todayISO, isUpcoming } from '@/lib/shows'
import { SplitHistoryList } from '@/components/finance/SplitHistoryList'
import { FinanceFloatingNav } from '@/components/finance/FinanceFloatingNav'
import type { SplitRun } from '@/types'

export default async function SplitHistoryPage() {
  const supabase = await createClient()
  const ws = await requireWorkspaceId()

  const [{ data: runs }, { data: unsplitShows }, pendingPayments] = await Promise.all([
    supabase.from('split_runs').select('*').eq('workspace_id', ws).order('created_at', { ascending: false }),
    supabase.from('shows').select('id, show_date').eq('workspace_id', ws).is('split_at', null),
    getCachedPendingPayments(),
  ])

  return (
    <div className="max-w-2xl">
      <Link href="/finance" className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> Finance
      </Link>
      <h1 className="mb-1 text-2xl font-bold text-gray-900">Split History</h1>
      <p className="mb-6 text-sm text-gray-500">Every time shows have been split, with who paid whom.</p>

      {!runs?.length ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center text-sm text-gray-400">
          No splits yet.
        </div>
      ) : (
        <SplitHistoryList runs={runs as unknown as SplitRun[]} unpaidPendingIds={pendingPayments.map(p => p.id)} />
      )}

      {/* A show that hasn't happened yet has nothing to split — same rule
          /finance/split itself enforces (404s if every unsplit show is
          still upcoming). Without this, the floating Split button could
          show up here even when pressing it would 404. */}
      <FinanceFloatingNav hasUnsplitShows={(unsplitShows ?? []).some(s => !isUpcoming(s.show_date, todayISO()))} />
    </div>
  )
}
