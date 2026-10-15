import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { sectionGuard } from '@/lib/section-guard'
import { getWorkspaceContext } from '@/lib/workspace'
import { getCachedAllProfiles, getCachedFinanceProjects, getCachedFinanceSettings, getCachedRecurring, getCachedUser } from '@/lib/data'
import { catchUpRecurring } from '@/lib/finance/recurring-server'
import { todayISO } from '@/lib/shows'
import { RecurringManager } from '@/components/finance/RecurringManager'
import { FeatureOff } from '@/components/finance/FeatureOff'
import { PageHeader } from '@/components/ui/PageHeader'

export default async function RecurringPage() {
  const denied = await sectionGuard('finance')
  if (denied) return denied
  const [settings, ctx, rules, projects, profiles, { data: { user } }] = await Promise.all([
    getCachedFinanceSettings(), getWorkspaceContext(), getCachedRecurring(), getCachedFinanceProjects(), getCachedAllProfiles(), getCachedUser(),
  ])
  const isAdmin = ctx?.current.role === 'owner' || ctx?.current.role === 'admin'

  const header = (
    <>
      <Link href="/finance" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> Finance
      </Link>
      <PageHeader title="Repeating entries" subtitle="Money that comes in or goes out on a schedule, added for you on each date." />
    </>
  )
  if (!settings.features.recurring) return <div>{header}<FeatureOff title="Repeating entries" isAdmin={isAdmin} /></div>

  await catchUpRecurring(rules)

  return (
    <div>
      {header}
      <RecurringManager
        rules={rules}
        members={profiles.map(p => ({ id: p.id, name: p.id === user?.id ? 'You' : (p.display_name ?? 'Member') }))}
        projects={projects}
        today={todayISO()}
        canEdit={ctx?.current.sections.finance === 'edit'}
      />
    </div>
  )
}
