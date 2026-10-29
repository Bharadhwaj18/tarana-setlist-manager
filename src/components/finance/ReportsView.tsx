'use client'

import { useMemo, useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { useMoney } from '@/components/finance/FinanceSettingsContext'
import { categoryLabel } from '@/lib/finance/settings'
import { groupTotals, summarise, isPayout, isTransfer } from '@/lib/finance/totals'
import { buildGroupedReportPdf } from '@/lib/pdf/financeReports'
import { APP_SLUG } from '@/lib/brand'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toaster'
import { cn } from '@/lib/utils'

export interface ReportEntry {
  date: string
  amount: number
  category: string | null
  tags: string[]
  project_id: string | null
  member_id: string | null
  show_id: string | null
}

interface Props {
  entries: ReportEntry[]
  today: string
  memberNames: Record<string, string>
  projectNames: Record<string, string>
  showTitles: Record<string, string>
}

type Period = 'this-month' | 'last-month' | 'this-year' | 'last-year' | 'all' | 'custom'
type GroupBy = 'category' | 'tag' | 'project' | 'member' | 'month' | 'show'

const PERIODS: { value: Period; label: string }[] = [
  { value: 'this-month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: 'this-year', label: 'This year' },
  { value: 'last-year', label: 'Last year' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Pick dates' },
]

function range(period: Period, today: string, from: string, to: string): [string, string] {
  const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7))
  const pad = (n: number) => String(n).padStart(2, '0')
  const monthEnd = (yy: number, mm: number) => `${yy}-${pad(mm)}-${pad(new Date(Date.UTC(yy, mm, 0)).getUTCDate())}`
  switch (period) {
    case 'this-month': return [`${y}-${pad(m)}-01`, monthEnd(y, m)]
    case 'last-month': { const ly = m === 1 ? y - 1 : y, lm = m === 1 ? 12 : m - 1; return [`${ly}-${pad(lm)}-01`, monthEnd(ly, lm)] }
    case 'this-year': return [`${y}-01-01`, `${y}-12-31`]
    case 'last-year': return [`${y - 1}-01-01`, `${y - 1}-12-31`]
    case 'all': return ['0000-01-01', '9999-12-31']
    case 'custom': return [from || '0000-01-01', to || '9999-12-31']
  }
}

function monthName(key: string) {
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(key + '-01T00:00:00Z'))
}

export function ReportsView({ entries, today, memberNames, projectNames, showTitles }: Props) {
  const { settings, money, signed } = useMoney()
  const toast = useToast()
  const [period, setPeriod] = useState<Period>('this-year')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [groupBy, setGroupBy] = useState<GroupBy>('category')

  const groupOptions: { value: GroupBy; label: string; singular: string }[] = [
    { value: 'category', label: 'Category', singular: 'Category' },
    { value: 'tag', label: 'Tag', singular: 'Tag' },
    ...(settings.features.projects ? [{ value: 'project' as const, label: 'Project', singular: 'Project' }] : []),
    { value: 'member', label: 'Person', singular: 'Person' },
    { value: 'month', label: 'Month', singular: 'Month' },
    { value: 'show', label: 'Show', singular: 'Show' },
  ]
  const group = groupOptions.find(g => g.value === groupBy) ?? groupOptions[0]

  const [start, end] = range(period, today, from, to)
  const inPeriod = useMemo(() => entries.filter(e => e.date >= start && e.date <= end), [entries, start, end])
  const totals = summarise(inPeriod)

  const groups = useMemo(() => {
    // Split payouts aren't income or spending; they're summed separately below.
    const real = inPeriod.filter(e => !isPayout(e) && !isTransfer(e))
    switch (group.value) {
      case 'category': return groupTotals(real, e => (e.category ? [e.category] : []), k => categoryLabel(settings, k), 'Uncategorised')
      case 'tag': return groupTotals(real, e => e.tags, k => `#${k}`, 'No tag')
      case 'project': return groupTotals(real, e => (e.project_id ? [e.project_id] : []), k => projectNames[k] ?? 'Deleted project', 'No project')
      case 'member': return groupTotals(real, e => (e.member_id ? [e.member_id] : []), k => memberNames[k] ?? 'Former member', 'Unattributed')
      case 'show': return groupTotals(real, e => (e.show_id ? [e.show_id] : []), k => showTitles[k] ?? 'Deleted show', 'Not for a show')
      case 'month': return groupTotals(real, e => [e.date.slice(0, 7)], monthName, '').sort((a, b) => b.key.localeCompare(a.key))
    }
  }, [inPeriod, group.value, settings, projectNames, memberNames, showTitles])

  const maxAbs = Math.max(1, ...groups.map(g => Math.max(g.totals.moneyIn, g.totals.moneyOut)))
  const periodLabel = period === 'custom'
    ? `${from || 'the start'} to ${to || 'today'}`
    : PERIODS.find(p => p.value === period)!.label
  const tagNote = group.value === 'tag' ? 'An entry with more than one tag is counted under each of them, so rows can add up to more than the total.' : undefined

  const downloadCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
    const lines = [
      [group.singular, 'Money in', 'Money out', 'Net'].map(esc).join(','),
      ...groups.map(g => [esc(g.label), g.totals.moneyIn, g.totals.moneyOut, g.totals.net].join(',')),
      ['Total', totals.moneyIn, totals.moneyOut, totals.net].map(v => (typeof v === 'string' ? esc(v) : v)).join(','),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${APP_SLUG}-report-${group.value}-${today}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast('CSV downloaded', 'success')
  }

  const downloadPdf = () => {
    buildGroupedReportPdf({
      periodLabel, groupLabel: group.singular, note: tagNote,
      rows: groups.map(g => ({ label: g.label, ...g.totals })),
      totals, money: { currency: settings.currency, fundName: settings.fundName },
    })
    toast('PDF downloaded', 'success')
  }

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-2xl border border-brand-200 bg-white p-4 shadow-sm">
        <div>
          <p className="mb-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-gray-500">When</p>
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
            {PERIODS.map(p => <Chip key={p.value} active={period === p.value} onClick={() => setPeriod(p.value)}>{p.label}</Chip>)}
          </div>
          {period === 'custom' && (
            <div className="mt-2 grid max-w-sm grid-cols-2 gap-2">
              <Input type="date" aria-label="From" value={from} onChange={e => setFrom(e.target.value)} />
              <Input type="date" aria-label="To" value={to} onChange={e => setTo(e.target.value)} />
            </div>
          )}
        </div>
        <div>
          <p className="mb-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-gray-500">Total by</p>
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
            {groupOptions.map(g => <Chip key={g.value} active={groupBy === g.value} onClick={() => setGroupBy(g.value)}>{g.label}</Chip>)}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Money in', value: money(totals.moneyIn), tone: 'text-brand-600 dark:text-emerald-400' },
          { label: 'Money out', value: money(totals.moneyOut), tone: 'text-red-700' },
          { label: 'Net', value: signed(totals.net), tone: totals.net < 0 ? 'text-red-700' : 'text-gray-900' },
          { label: 'Paid to members', value: money(totals.payouts), tone: 'text-gray-900' },
        ].map(t => (
          <div key={t.label} className="rounded-2xl border border-brand-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-gray-500">{t.label}</p>
            <p className={cn('font-display text-xl font-bold tabular-nums', t.tone)}>{t.value}</p>
          </div>
        ))}
      </div>

      {groups.length === 0 ? (
        <EmptyState title="Nothing in this period" description="Try a wider date range." />
      ) : (
        <section className="overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-100 px-4 py-3">
            <p className="text-sm font-bold text-gray-900">{periodLabel}, by {group.label.toLowerCase()}</p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={downloadCsv}><Download className="h-4 w-4" /> CSV</Button>
              <Button variant="secondary" size="sm" onClick={downloadPdf}><FileText className="h-4 w-4" /> PDF</Button>
            </div>
          </div>
          <ul className="divide-y divide-brand-100">
            {groups.map(g => (
              <li key={g.key || 'none'} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-semibold text-gray-900">{g.label}</span>
                  <span className={cn('shrink-0 text-sm font-extrabold tabular-nums', g.totals.net < 0 ? 'text-red-700' : 'text-gray-900')}>{signed(g.totals.net)}</span>
                </div>
                <div className="mt-1.5 grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-xs">
                  <div className="h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-brand-400 dark:bg-emerald-400" style={{ width: `${(g.totals.moneyIn / maxAbs) * 100}%` }} /></div>
                  <span className="w-24 text-right tabular-nums text-gray-600">in {money(g.totals.moneyIn)}</span>
                  <div className="h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-red-500" style={{ width: `${(g.totals.moneyOut / maxAbs) * 100}%` }} /></div>
                  <span className="w-24 text-right tabular-nums text-gray-600">out {money(g.totals.moneyOut)}</span>
                </div>
              </li>
            ))}
          </ul>
          {tagNote && <p className="border-t border-brand-100 px-4 py-2 text-xs text-gray-500">{tagNote}</p>}
        </section>
      )}
    </div>
  )
}
