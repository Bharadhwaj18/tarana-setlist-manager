import type { Database } from './database'
import type { SplitReportRow, SplitReportShow, BandFundBalance } from '@/lib/pdf/financeReports'

type Row = Database['public']['Tables']['split_runs']['Row']

export interface SplitRunShow { id: string; title: string; date: string | null; net: number }

export interface SplitRunPayment {
  from: string
  to: string
  fromName: string
  toName: string
  amount: number
  kind: 'self' | 'transfer'
  /** Set on a transfer — the pending_payments row it created, used to show whether it's been paid yet. */
  pendingId?: string
}

/** Exactly the arguments the Split Report PDF is built from, frozen at split time. */
export interface SplitRunReport {
  showTitles: string[]
  bandPct: number
  shows: SplitReportShow[]
  rows: SplitReportRow[]
  totalNet: number
  totalBandFund: number
  allBalances: BandFundBalance[]
  /** How the split was set up — not part of the PDF, kept so the run is fully reproducible. */
  meta?: {
    mode: 'manual' | 'auto'
    balancesBefore: BandFundBalance[]
    involvedByShow: { showTitle: string; names: string[] }[]
  }
}

// One row per split run — a batch of one or more shows split together. The
// JSON columns are a snapshot, so later edits to shows or transactions never
// rewrite history. `report` is null (and `reconstructed` true) for splits
// backfilled from before this table existed.
export type SplitRun = Omit<Row, 'shows' | 'payments' | 'report'> & {
  shows: SplitRunShow[]
  payments: SplitRunPayment[]
  report: SplitRunReport | null
}
