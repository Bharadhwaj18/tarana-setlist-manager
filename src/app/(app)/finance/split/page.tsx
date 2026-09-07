import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getCachedAllProfiles, getCachedUser } from '@/lib/data'
import { SplitWizard } from '@/components/finance/SplitWizard'
import type { FinanceTransaction } from '@/types/finance'

export default async function SplitPage() {
  const supabase = await createClient()

  const [{ data: { user } }, profiles, { data: shows }, { data: allTxns }] = await Promise.all([
    getCachedUser(),
    getCachedAllProfiles(),
    supabase.from('finance_shows').select('*').is('split_at', null).order('show_date', { ascending: false }),
    supabase.from('finance_transactions').select('*'),
  ])

  if (!shows?.length) notFound()

  const members = profiles.map(p => ({
    id: p.id,
    name: p.id === user?.id ? 'You' : (p.display_name ?? 'Member'),
  }))
  // A separate, "You"-free name list — anything that becomes a permanent
  // record other people read later (a saved transaction description, the
  // downloadable report) should always show whose it actually is, not
  // "You" relative to whoever happened to confirm the split.
  const realNames = profiles.map(p => ({ id: p.id, name: p.display_name ?? 'Member' }))

  const showIds = new Set(shows.map(s => s.id))
  const txnsByShow: Record<string, FinanceTransaction[]> = {}
  for (const t of allTxns ?? []) {
    if (!t.show_id || !showIds.has(t.show_id)) continue
    if (!txnsByShow[t.show_id]) txnsByShow[t.show_id] = []
    txnsByShow[t.show_id].push(t)
  }

  // Each member's current overall balance — the "standing balance" the
  // reimbursement floor checks against. Transactions tagged to shows in
  // *this* unsplit batch get backed out client-side per show, since those
  // haven't been settled yet and shouldn't count as pre-existing balance.
  const balances: Record<string, number> = {}
  // Each member's current tagged Band Fund balance specifically (category
  // 'fund' transactions only) — this section only tracks Band Fund, and
  // settlement routing (who self-satisfies, who consolidates) runs on this
  // figure, not the member's whole balance.
  const fundBalances: Record<string, number> = {}
  for (const t of allTxns ?? []) {
    if (!t.member_id) continue
    balances[t.member_id] = (balances[t.member_id] ?? 0) + t.amount
    if (t.category === 'fund') {
      fundBalances[t.member_id] = (fundBalances[t.member_id] ?? 0) + t.amount
    }
  }

  return (
    <div className="max-w-2xl">
      <Link href="/finance" className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> Finance
      </Link>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Split Show Money</h1>
      <SplitWizard
        shows={shows}
        members={members}
        realNames={realNames}
        txnsByShow={txnsByShow}
        memberBalances={balances}
        memberFundBalances={fundBalances}
      />
    </div>
  )
}
