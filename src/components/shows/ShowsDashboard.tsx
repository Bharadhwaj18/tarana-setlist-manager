import { SectionLabel } from '@/components/ui/SectionLabel'
import { EmptyState } from '@/components/ui/EmptyState'

export interface CountRow { label: string; count: number }
export interface RevenueRow { label: string; value: number }

export interface ShowsInsights {
  formatBreakdown: CountRow[]
  revenueByFormat: RevenueRow[]
  showsPerYear: CountRow[]
  topCities: CountRow[]
}

export function fmt(n: number) {
  return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

/** One green, stepping down in strength by rank, so charts stay calm and on-palette. */
const opacityFor = (rank: number) => Math.max(0.35, 1 - rank * 0.15)

export function BarList({ rows, formatValue, labelWidth = 'w-36' }: {
  rows: { label: string; value: number }[]
  formatValue: (n: number) => string
  labelWidth?: string
}) {
  const max = Math.max(...rows.map(r => r.value), 1)
  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => (
        <div key={r.label} className="flex items-center gap-3">
          <span className={`${labelWidth} shrink-0 truncate text-xs font-medium text-gray-700`} title={r.label}>{r.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-brand-100">
            <div
              className="h-full rounded-full bg-brand-400"
              style={{ width: `${Math.round((r.value / max) * 100)}%`, opacity: opacityFor(i) }}
            />
          </div>
          <span className="w-20 shrink-0 truncate text-right text-xs font-bold tabular-nums text-gray-900" title={formatValue(r.value)}>{formatValue(r.value)}</span>
        </div>
      ))}
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
      <SectionLabel className="mb-4">{title}</SectionLabel>
      {children}
    </div>
  )
}

export function ShowsDashboard({ formatBreakdown, revenueByFormat, showsPerYear, topCities }: ShowsInsights) {
  if (formatBreakdown.length === 0) {
    return <EmptyState title="No insights yet" description="Charts appear once you have played shows." />
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Panel title="Shows by format">
        <BarList rows={formatBreakdown.map(r => ({ label: r.label, value: r.count }))} formatValue={n => String(n)} />
      </Panel>
      {revenueByFormat.length > 0 && (
        <Panel title="Revenue by format">
          <BarList rows={revenueByFormat.map(r => ({ label: r.label, value: r.value }))} formatValue={fmt} />
        </Panel>
      )}
      {showsPerYear.length > 0 && (
        <Panel title="Shows per year">
          <BarList rows={showsPerYear.map(r => ({ label: r.label, value: r.count }))} formatValue={n => String(n)} />
        </Panel>
      )}
      {topCities.length > 0 && (
        <Panel title="Top cities & venues">
          <BarList rows={topCities.map(r => ({ label: r.label, value: r.count }))} formatValue={n => String(n)} />
        </Panel>
      )}
    </div>
  )
}
