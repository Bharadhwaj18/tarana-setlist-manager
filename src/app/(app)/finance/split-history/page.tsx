import Link from 'next/link'
import { sectionGuard } from '@/lib/section-guard'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspaceId } from '@/lib/workspace'
import { getCachedPendingPayments } from '@/lib/data'
import { todayISO, isUpcoming } from '@/lib/shows'
import { SplitHistoryList } from '@/components/finance/SplitHistoryList'
import { FinanceFloatingNav } from '@/components/finance/FinanceFloatingNav'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import type { SplitRun } from '@/types'

export default async function SplitHistoryPage() {
  const denied = await sectionGuard('finance')
  if (denied) return denied
  const supabase = await createClient()
  const ws = await requireWorkspaceId()

  const [{ data: runs }, { data: unsplitShows }, pendingPayments] = await Promise.all([
    supabase.from('split_runs').select('*').eq('workspace_id', ws).order('created_at', { ascending: false }),
    supabase.from('shows').select('id, show_date').eq('workspace_id', ws).is('split_at', null),
    getCachedPendingPayments(),
  ])

  // A show that hasn't happened yet has nothing to split — same rule
  // /finance/split itself enforces (404s if every unsplit show is
  // still upcoming). Without this, the Split button could show up here
  // even when pressing it would 404.
  const canSplit = (unsplitShows ?? []).some(s => !isUpcoming(s.show_date, todayISO()))
  const pendingCount = pendingPayments.length

  return (
    <div className="max-w-3xl">
      <Link href="/finance" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> Finance
      </Link>
      <PageHeader
        title="Split history"
        subtitle={
          runs?.length
            ? `${runs.length} split${runs.length !== 1 ? 's' : ''} · ${pendingCount} payment${pendingCount !== 1 ? 's' : ''} still pending`
            : 'Every time shows have been split, with who paid whom.'
        }
        action={canSplit ? <Button asChild><Link href="/finance/split">+ Split shows</Link></Button> : undefined}
      />

      {!runs?.length ? (
        <EmptyState title="No splits yet" description="Once you split a show, who paid whom shows up here." />
      ) : (
        <SplitHistoryList runs={runs as unknown as SplitRun[]} unpaidPendingIds={pendingPayments.map(p => p.id)} />
      )}

      <FinanceFloatingNav hasUnsplitShows={canSplit} />
    </div>
  )
}
