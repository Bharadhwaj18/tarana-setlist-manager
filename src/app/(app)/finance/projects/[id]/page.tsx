import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { sectionGuard } from '@/lib/section-guard'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspaceId } from '@/lib/workspace'
import { getCachedAllProfiles, getCachedFinanceProjects, getCachedFinanceSettings, getCachedUser } from '@/lib/data'
import { categoryLabel, formatMoney } from '@/lib/finance/settings'
import { groupTotals, summarise } from '@/lib/finance/totals'
import { FinanceExtrasProvider } from '@/components/finance/FinanceSettingsContext'
import { TransactionRow } from '@/components/finance/TransactionRow'
import { BudgetBar } from '@/components/finance/ProjectsManager'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'

interface Props { params: Promise<{ id: string }> }

export default async function ProjectPage({ params }: Props) {
  const denied = await sectionGuard('finance')
  if (denied) return denied
  const { id } = await params
  const supabase = await createClient()
  const ws = await requireWorkspaceId()

  const [settings, projects, profiles, { data: { user } }, { data: txns }, { data: shows }] = await Promise.all([
    getCachedFinanceSettings(),
    getCachedFinanceProjects(),
    getCachedAllProfiles(),
    getCachedUser(),
    supabase.from('finance_transactions').select('*').eq('workspace_id', ws).eq('project_id', id).order('date', { ascending: false }),
    supabase.from('shows').select('*').eq('workspace_id', ws),
  ])
  const project = projects.find(p => p.id === id)
  if (!project) notFound()

  const entries = txns ?? []
  const totals = summarise(entries)
  const byCategory = groupTotals(entries, e => (e.category ? [e.category] : []), k => categoryLabel(settings, k), 'Uncategorised')
  const money = (n: number) => formatMoney(n, settings.currency)
  const members = profiles.map(p => ({ id: p.id, name: p.id === user?.id ? 'You' : (p.display_name ?? 'Member') }))
  const nameOf = (mid: string | null) => (mid ? members.find(m => m.id === mid)?.name ?? 'Member' : 'Unattributed')
  const showTitleById = Object.fromEntries((shows ?? []).map(s => [s.id, s.title]))

  const card = 'rounded-2xl border border-brand-200 bg-white p-5 shadow-sm'

  return (
    <FinanceExtrasProvider projects={projects} knownTags={[...new Set(entries.flatMap(t => t.tags ?? []))]}>
      <div className="space-y-5">
        <div>
          <Link href="/finance/projects" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-gray-700">
            <ChevronLeft className="h-4 w-4" /> Projects
          </Link>
          <PageHeader title={project.name} subtitle={project.archived_at ? 'Finished' : `${totals.count} entr${totals.count === 1 ? 'y' : 'ies'}`} className="mb-0" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <section className={card}>
            <SectionLabel className="mb-3">Totals</SectionLabel>
            <dl className="grid grid-cols-3 gap-3">
              <div><dt className="text-xs text-gray-500">Money in</dt><dd className="font-display text-xl font-bold tabular-nums text-brand-600 dark:text-emerald-400">{money(totals.moneyIn)}</dd></div>
              <div><dt className="text-xs text-gray-500">Money out</dt><dd className="font-display text-xl font-bold tabular-nums text-red-700">{money(totals.moneyOut)}</dd></div>
              <div><dt className="text-xs text-gray-500">Net</dt><dd className={cn('font-display text-xl font-bold tabular-nums', totals.net < 0 ? 'text-red-700' : 'text-gray-900')}>{totals.net < 0 ? '−' : ''}{money(totals.net)}</dd></div>
            </dl>
            {project.budget != null && project.budget > 0 && <div className="mt-4"><BudgetBar spent={totals.moneyOut} budget={project.budget} /></div>}
          </section>

          <section className={card}>
            <SectionLabel className="mb-3">By category</SectionLabel>
            {byCategory.length === 0 ? <p className="text-sm text-gray-500">Nothing yet.</p> : (
              <ul className="space-y-1.5 text-sm">
                {byCategory.map(g => (
                  <li key={g.key} className="flex justify-between gap-3">
                    <span className="text-gray-700">{g.label}</span>
                    <span className={cn('font-semibold tabular-nums', g.totals.net < 0 ? 'text-red-700' : 'text-gray-900')}>{g.totals.net < 0 ? '−' : '+'}{money(g.totals.net)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section>
          <SectionLabel className="mb-3">Entries</SectionLabel>
          {entries.length === 0 ? (
            <EmptyState title="No entries in this project yet" description="When adding money in or out, choose this project." />
          ) : (
            <div className="divide-y divide-brand-100 overflow-hidden rounded-2xl border border-brand-200 bg-white">
              {entries.map(t => (
                <TransactionRow
                  key={t.id}
                  transaction={t}
                  members={members}
                  shows={shows ?? []}
                  payerName={nameOf(t.member_id)}
                  badge={t.show_id && showTitleById[t.show_id] ? { label: showTitleById[t.show_id], kind: 'show' } : t.category ? { label: categoryLabel(settings, t.category), kind: 'category' } : undefined}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </FinanceExtrasProvider>
  )
}
