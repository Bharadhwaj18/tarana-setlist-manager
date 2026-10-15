'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Archive, ArchiveRestore, FolderKanban, Pencil, Plus, Trash2 } from 'lucide-react'
import { createProject, deleteProject, setProjectArchived, updateProject } from '@/actions/finance-settings'
import { useMoney } from '@/components/finance/FinanceSettingsContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { useToast } from '@/components/ui/Toaster'
import { cn } from '@/lib/utils'
import type { Totals } from '@/lib/finance/totals'
import type { FinanceProject } from '@/types/finance'

export interface ProjectRow { project: FinanceProject; totals: Totals }

const label = 'mb-1.5 block text-sm font-bold text-gray-800'

function dateRange(p: FinanceProject) {
  const f = (iso: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso + 'T00:00:00Z'))
  if (p.start_date && p.end_date) return `${f(p.start_date)} – ${f(p.end_date)}`
  if (p.start_date) return `From ${f(p.start_date)}`
  if (p.end_date) return `Until ${f(p.end_date)}`
  return null
}

export function ProjectForm({ existing, open, onOpenChange }: { existing?: FinanceProject; open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter()
  const toast = useToast()
  const { symbol } = useMoney()
  const [name, setName] = useState(existing?.name ?? '')
  const [start, setStart] = useState(existing?.start_date ?? '')
  const [end, setEnd] = useState(existing?.end_date ?? '')
  const [budget, setBudget] = useState(existing?.budget != null ? String(existing.budget) : '')
  const [pending, startTransition] = useTransition()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const input = { name, start_date: start || null, end_date: end || null, budget: budget.trim() ? Number(budget) : null }
    startTransition(async () => {
      const res = existing ? await updateProject(existing.id, input) : await createProject(input)
      if (res.error) { toast(res.error, 'error'); return }
      toast(existing ? 'Project saved' : 'Project created', 'success')
      onOpenChange(false)
      if (!existing) { setName(''); setStart(''); setEnd(''); setBudget('') }
      router.refresh()
    })
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={existing ? 'Edit project' : 'New project'}
      description="A tour, an album, a festival season: anything you want to see the money for on its own." className="max-w-[460px] rounded-2xl">
      <form onSubmit={submit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="project-name" className={label}>Name</label>
          <Input id="project-name" value={name} maxLength={80} required autoFocus placeholder="e.g. South India tour 2026" onChange={e => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="project-start" className={label}>Starts <span className="font-normal text-gray-500">(optional)</span></label>
            <Input id="project-start" type="date" value={start} onChange={e => setStart(e.target.value)} />
          </div>
          <div>
            <label htmlFor="project-end" className={label}>Ends <span className="font-normal text-gray-500">(optional)</span></label>
            <Input id="project-end" type="date" value={end} onChange={e => setEnd(e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="project-budget" className={label}>Spending budget <span className="font-normal text-gray-500">(optional)</span></label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">{symbol}</span>
            <Input id="project-budget" type="number" min={0} step="any" value={budget} className="pl-8" placeholder="0" onChange={e => setBudget(e.target.value)} />
          </div>
          <p className="mt-1 text-xs text-gray-500">You’ll see how much of it is spent as entries are added to this project.</p>
        </div>
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" loading={pending} disabled={!name.trim()}>{existing ? 'Save' : 'Create project'}</Button>
        </div>
      </form>
    </Modal>
  )
}

export function BudgetBar({ spent, budget }: { spent: number; budget: number }) {
  const { money } = useMoney()
  const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0
  const over = spent > budget
  return (
    <div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div className={cn('h-full rounded-full', over ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-brand-400 dark:bg-emerald-400')} style={{ width: `${over ? 100 : pct}%` }} />
      </div>
      <p className={cn('mt-1 text-xs', over ? 'font-bold text-red-700' : 'text-gray-500')}>
        {over ? `Over budget by ${money(spent - budget)}` : `${money(spent)} of ${money(budget)} spent · ${money(budget - spent)} left`}
      </p>
    </div>
  )
}

function ProjectCard({ row, canEdit }: { row: ProjectRow; canEdit: boolean }) {
  const { project: p, totals } = row
  const { money, signed } = useMoney()
  const router = useRouter()
  const toast = useToast()
  const [editOpen, setEditOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const range = dateRange(p)

  const run = (fn: () => Promise<{ error?: string }>, done: string) =>
    startTransition(async () => {
      const res = await fn()
      if (res.error) { toast(res.error, 'error'); return }
      toast(done, 'success')
      router.refresh()
    })

  return (
    <section className={cn('flex flex-col gap-3 rounded-2xl border border-brand-200 bg-white p-5 shadow-sm', p.archived_at && 'opacity-75')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/finance/projects/${p.id}`} className="block truncate font-display text-lg font-bold text-gray-900 hover:text-brand-700">{p.name}</Link>
          <p className="text-xs text-gray-500">{[range, `${totals.count} entr${totals.count === 1 ? 'y' : 'ies'}`].filter(Boolean).join(' · ')}</p>
        </div>
        {canEdit && (
          <div className="flex shrink-0 gap-1">
            <button type="button" aria-label="Edit project" onClick={() => setEditOpen(true)} className="rounded-md p-1.5 text-gray-500 hover:bg-brand-100"><Pencil className="h-4 w-4" /></button>
            <button type="button" aria-label={p.archived_at ? 'Reopen project' : 'Mark project finished'} title={p.archived_at ? 'Reopen' : 'Mark finished'} disabled={pending}
              onClick={() => run(() => setProjectArchived(p.id, !p.archived_at), p.archived_at ? 'Project reopened' : 'Marked finished')}
              className="rounded-md p-1.5 text-gray-500 hover:bg-brand-100">{p.archived_at ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}</button>
            <button type="button" aria-label="Delete project" disabled={pending}
              onClick={() => { if (window.confirm(`Delete “${p.name}”? Its entries stay, they just won’t belong to a project.`)) run(() => deleteProject(p.id), 'Project deleted') }}
              className="rounded-md p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
          </div>
        )}
      </div>
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div><dt className="text-xs text-gray-500">In</dt><dd className="font-bold tabular-nums text-brand-600 dark:text-emerald-400">{money(totals.moneyIn)}</dd></div>
        <div><dt className="text-xs text-gray-500">Out</dt><dd className="font-bold tabular-nums text-red-700">{money(totals.moneyOut)}</dd></div>
        <div><dt className="text-xs text-gray-500">Net</dt><dd className={cn('font-bold tabular-nums', totals.net < 0 ? 'text-red-700' : 'text-gray-900')}>{signed(totals.net)}</dd></div>
      </dl>
      {p.budget != null && p.budget > 0 && <BudgetBar spent={totals.moneyOut} budget={p.budget} />}
      <ProjectForm existing={p} open={editOpen} onOpenChange={setEditOpen} />
    </section>
  )
}

export function ProjectsManager({ rows, canEdit }: { rows: ProjectRow[]; canEdit: boolean }) {
  const [newOpen, setNewOpen] = useState(false)
  const active = rows.filter(r => !r.project.archived_at)
  const finished = rows.filter(r => r.project.archived_at)

  return (
    <div className="space-y-6">
      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> New project</Button>
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState icon={<FolderKanban className="h-8 w-8" />} title="No projects yet"
          description="Create one for a tour or an album, then pick it when adding money in or out."
          action={canEdit ? <Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> New project</Button> : undefined} />
      ) : (
        <>
          {active.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">{active.map(r => <ProjectCard key={r.project.id} row={r} canEdit={canEdit} />)}</div>
          )}
          {finished.length > 0 && (
            <div>
              <SectionLabel className="mb-3">Finished</SectionLabel>
              <div className="grid gap-4 md:grid-cols-2">{finished.map(r => <ProjectCard key={r.project.id} row={r} canEdit={canEdit} />)}</div>
            </div>
          )}
        </>
      )}
      <ProjectForm open={newOpen} onOpenChange={setNewOpen} />
    </div>
  )
}
