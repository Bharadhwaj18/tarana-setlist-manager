import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getCachedAllProfiles, getCachedPendingPayments } from '@/lib/data'
import { todayISO, isUpcoming } from '@/lib/shows'
import { SplitHistoryList } from '@/components/finance/SplitHistoryList'
import { FinanceFloatingNav } from '@/components/finance/FinanceFloatingNav'
import type { FinanceTransaction } from '@/types/finance'
import type { PendingPayment } from '@/types'

export default async function SplitHistoryPage() {
  const supabase = await createClient()

  const [profiles, { data: shows }, { data: allTxns }, { data: unsplitShows }, pendingPayments] = await Promise.all([
    getCachedAllProfiles(),
    supabase.from('shows').select('*').not('split_at', 'is', null).order('split_at', { ascending: false }),
    supabase.from('finance_transactions').select('*').eq('category', 'split'),
    supabase.from('shows').select('id, show_date').is('split_at', null),
    getCachedPendingPayments(),
  ])

  const txnsByShow: Record<string, FinanceTransaction[]> = {}
  for (const t of allTxns ?? []) {
    if (!t.show_id) continue
    if (!txnsByShow[t.show_id]) txnsByShow[t.show_id] = []
    txnsByShow[t.show_id].push(t)
  }

  const pendingByShow: Record<string, PendingPayment[]> = {}
  for (const p of pendingPayments) {
    if (!p.show_id) continue
    if (!pendingByShow[p.show_id]) pendingByShow[p.show_id] = []
    pendingByShow[p.show_id].push(p)
  }

  return (
    <div className="max-w-2xl">
      <Link href="/finance" className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> Finance
      </Link>
      <h1 className="mb-1 text-2xl font-bold text-gray-900">Split History</h1>
      <p className="mb-6 text-sm text-gray-500">Every show that&apos;s been split, with exactly who paid what.</p>

      {!shows?.length ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center text-sm text-gray-400">
          No shows have been split yet.
        </div>
      ) : (
        <SplitHistoryList shows={shows} txnsByShow={txnsByShow} pendingByShow={pendingByShow} profiles={profiles} />
      )}

      {/* A show that hasn't happened yet has nothing to split — same rule
          /finance/split itself enforces (404s if every unsplit show is
          still upcoming). Without this, the floating Split button could
          show up here even when pressing it would 404. */}
      <FinanceFloatingNav hasUnsplitShows={(unsplitShows ?? []).some(s => !isUpcoming(s.show_date, todayISO()))} />
    </div>
  )
}
