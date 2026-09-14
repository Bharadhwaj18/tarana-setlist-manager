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
          <span className="w-16 shrink-0 text-right text-xs font-bold tabular-nums text-gray-800">{formatValue(r.value)}</span>
        </div>
      ))}
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">{title}</h3>
      {children}
    </div>
  )
}

export function ShowsDashboard({ totalPlayed, totalRevenue, formatBreakdown, revenueByFormat, showsPerYear, topCities }: ShowsDashboardProps) {
  if (totalPlayed === 0) return null

  return (
    <div className="mb-6 space-y-4">
      {/* Headline tiles */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-400"><Music2 className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wider">Played</span></div>
          <p className="mt-1.5 text-2xl font-bold text-gray-900">{totalPlayed}</p>
        </div>
        <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-400"><Tags className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wider">Formats</span></div>
          <p className="mt-1.5 text-2xl font-bold text-gray-900">{formatBreakdown.length}</p>
        </div>
        <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-400"><Wallet className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wider">Revenue</span></div>
          <p className="mt-1.5 text-2xl font-bold text-gray-900">{fmt(totalRevenue)}</p>
        </div>
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
