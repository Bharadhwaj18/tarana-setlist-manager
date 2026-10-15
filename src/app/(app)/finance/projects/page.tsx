import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { sectionGuard } from '@/lib/section-guard'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceContext, requireWorkspaceId } from '@/lib/workspace'
import { getCachedFinanceProjects, getCachedFinanceSettings } from '@/lib/data'
import { summarise } from '@/lib/finance/totals'
import { ProjectsManager, type ProjectRow } from '@/components/finance/ProjectsManager'
import { FeatureOff } from '@/components/finance/FeatureOff'
import { PageHeader } from '@/components/ui/PageHeader'

export default async function ProjectsPage() {
  const denied = await sectionGuard('finance')
  if (denied) return denied
  const [settings, ctx] = await Promise.all([getCachedFinanceSettings(), getWorkspaceContext()])
  const isAdmin = ctx?.current.role === 'owner' || ctx?.current.role === 'admin'

  const header = (
    <>
      <Link href="/finance" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> Finance
      </Link>
      <PageHeader title="Projects" subtitle="Tours, albums and anything else you want the money for on its own." />
    </>
  )
  if (!settings.features.projects) return <div>{header}<FeatureOff title="Projects" isAdmin={isAdmin} /></div>

  const supabase = await createClient()
  const ws = await requireWorkspaceId()
  const [projects, { data: txns }] = await Promise.all([
    getCachedFinanceProjects(),
    supabase.from('finance_transactions').select('amount, category, project_id').eq('workspace_id', ws).not('project_id', 'is', null),
  ])

  const rows: ProjectRow[] = projects.map(p => ({ project: p, totals: summarise((txns ?? []).filter(t => t.project_id === p.id)) }))

  return (
    <div>
      {header}
      <ProjectsManager rows={rows} canEdit={ctx?.current.sections.finance === 'edit'} />
    </div>
  )
}
