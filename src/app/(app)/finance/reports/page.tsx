import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { sectionGuard } from '@/lib/section-guard'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspaceId } from '@/lib/workspace'
import { getCachedAllProfiles, getCachedFinanceProjects } from '@/lib/data'
import { todayISO } from '@/lib/shows'
import { ReportsView } from '@/components/finance/ReportsView'
import { PageHeader } from '@/components/ui/PageHeader'

export default async function ReportsPage() {
  const denied = await sectionGuard('finance')
  if (denied) return denied
  const supabase = await createClient()
  const ws = await requireWorkspaceId()

  const [{ data: entries }, { data: shows }, profiles, projects] = await Promise.all([
    supabase.from('finance_transactions').select('date, amount, category, tags, project_id, member_id, show_id').eq('workspace_id', ws),
    supabase.from('shows').select('id, title').eq('workspace_id', ws),
    getCachedAllProfiles(),
    getCachedFinanceProjects(),
  ])

  return (
    <div>
      <Link href="/finance" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> Finance
      </Link>
      <PageHeader title="Reports" subtitle="Where the money came from and where it went, for any period." />
      <ReportsView
        entries={(entries ?? []).map(e => ({ ...e, tags: e.tags ?? [] }))}
        today={todayISO()}
        memberNames={Object.fromEntries(profiles.map(p => [p.id, p.display_name ?? 'Member']))}
        projectNames={Object.fromEntries(projects.map(p => [p.id, p.name]))}
        showTitles={Object.fromEntries((shows ?? []).map(s => [s.id, s.title]))}
      />
    </div>
  )
}
