import { Music2, Wallet, Tags } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CountRow { label: string; count: number }
interface RevenueRow { label: string; value: number }

interface ShowsDashboardProps {
  totalPlayed: number
  totalRevenue: number
  formatBreakdown: CountRow[]
  revenueByFormat: RevenueRow[]
  showsPerYear: CountRow[]
  topCities: CountRow[]
}

function fmt(n: number) {
  return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function BarList({ rows, formatValue, barClassName }: {
  rows: { label: string; value: number }[]
  formatValue: (n: number) => string
  barClassName?: string
}) {
  const max = Math.max(...rows.map(r => r.value), 1)
  return (
    <div className="space-y-2.5">
      {rows.map(r => (
        <div key={r.label} className="flex items-center gap-3">
          <span className="w-36 shrink-0 truncate text-xs font-medium text-gray-600" title={r.label}>{r.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
            <div
              className={cn('h-full rounded-full', barClassName ?? 'bg-brand-400')}
              style={{ width: `${Math.round((r.value / max) * 100)}%` }}
            />
          </div>
          <span className="w-20 shrink-0 truncate text-right text-xs font-bold tabular-nums text-gray-800" title={formatValue(r.value)}>{formatValue(r.value)}</span>
        </div>
      ))}
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-brand-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">{title}</h3>
      {children}
    </div>
  )
}

// A headline stat tile — sized down and clamped to one line so a long
// figure (₹5,58,032 and up) can't push past its own tile edge in a fixed
// multi-column grid, which doesn't get the usual chance to wrap or stack
// narrower on mobile the way sm:grid-cols-N layouts do. This pattern
// (min-w-0 on the grid item + a responsive, truncating value) is the one to
// reuse for any other tight-grid stat display, not just this dashboard.
function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-xl border border-brand-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex items-center gap-1.5 text-gray-400 sm:gap-2">
        {icon}
        <span className="truncate text-[10px] font-semibold uppercase tracking-wider sm:text-xs">{label}</span>
      </div>
      <p className="mt-1.5 truncate text-base font-bold text-gray-900 sm:text-2xl" title={String(value)}>{value}</p>
    </div>
  )
}

export function ShowsDashboard({ totalPlayed, totalRevenue, formatBreakdown, revenueByFormat, showsPerYear, topCities }: ShowsDashboardProps) {
  if (totalPlayed === 0) return null

  return (
    <div className="mb-6 space-y-4">
      {/* Headline tiles */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatTile icon={<Music2 className="h-4 w-4 shrink-0" />} label="Played" value={totalPlayed} />
        <StatTile icon={<Tags className="h-4 w-4 shrink-0" />} label="Formats" value={formatBreakdown.length} />
        <StatTile icon={<Wallet className="h-4 w-4 shrink-0" />} label="Revenue" value={fmt(totalRevenue)} />
      </div>

      {/* Breakdowns */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Panel title="Shows by format">
          <BarList rows={formatBreakdown.map(r => ({ label: r.label, value: r.count }))} formatValue={n => String(n)} />
        </Panel>
        {revenueByFormat.length > 0 && (
          <Panel title="Revenue by format">
            <BarList rows={revenueByFormat.map(r => ({ label: r.label, value: r.value }))} formatValue={fmt} barClassName="bg-emerald-400" />
          </Panel>
        )}
        {showsPerYear.length > 0 && (
          <Panel title="Shows per year">
            <BarList rows={showsPerYear.map(r => ({ label: r.label, value: r.count }))} formatValue={n => String(n)} barClassName="bg-sky-400" />
          </Panel>
        )}
        {topCities.length > 0 && (
          <Panel title="Top cities & venues">
            <BarList rows={topCities.map(r => ({ label: r.label, value: r.count }))} formatValue={n => String(n)} barClassName="bg-amber-400" />
          </Panel>
        )}
      </div>
    </div>
  )
}
