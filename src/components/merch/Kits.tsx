'use client'

import Link from 'next/link'
import { ChevronRight, Package } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { StatusPill } from '@/components/ui/StatusPill'
import { useMoney } from '@/components/finance/FinanceSettingsContext'
import { formatDateDMY } from '@/lib/dates'
import { KIT_STATUS_LABELS, kitSoldByVariant, type KitStatus, type MerchKit, type MerchKitLine, type MerchMove } from '@/lib/merch'

const tone = (s: KitStatus) => (s === 'approved' ? 'green' : s === 'closed' ? 'amber' : 'gray')

export interface CrewKit {
  id: string
  show_title: string | null
  show_date: string | null
  venue: string | null
  status: string
}

/** What Merch crew see: only the kits they're on. */
export function CrewHome({ kits }: { kits: CrewKit[] }) {
  const open = kits.filter(k => k.status === 'open')
  const past = kits.filter(k => k.status !== 'open')
  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-3xl font-bold text-gray-900">Merch</h1>
      <p className="mb-5 text-sm text-gray-500">The shows you’re running merch for.</p>
      {kits.length === 0 ? (
        <EmptyState icon={<Package className="h-10 w-10" />} title="No kits yet" description="When you’re put on a show’s merch, it shows up here." />
      ) : (
        <div className="space-y-6">
          {open.length > 0 && <KitLinks label="Coming up / tonight" kits={open} />}
          {past.length > 0 && <KitLinks label="Past shows" kits={past} />}
        </div>
      )}
    </div>
  )
}

function KitLinks({ label, kits }: { label: string; kits: CrewKit[] }) {
  return (
    <div>
      <SectionLabel className="mb-2">{label}</SectionLabel>
      <ul className="divide-y divide-brand-100 overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-sm">
        {kits.map(k => (
          <li key={k.id}>
            <Link href={`/merch/kits/${k.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-brand-50">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{k.show_title ?? 'Deleted show'}</p>
                <p className="text-xs text-gray-500">{[k.show_date && formatDateDMY(k.show_date), k.venue].filter(Boolean).join(' · ')}</p>
              </div>
              <StatusPill tone={tone(k.status as KitStatus)}>{KIT_STATUS_LABELS[k.status as KitStatus] ?? k.status}</StatusPill>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export type KitWithShow = MerchKit & { show: { id: string; title: string; show_date: string | null; venue: string | null } | null }

/** The Kits tab: every kit, newest show first, with how it's going. */
export function KitsList({ kits, lines, moves, nameOf }: { kits: KitWithShow[]; lines: MerchKitLine[]; moves: MerchMove[]; nameOf: (id: string | null) => string }) {
  const { money } = useMoney()
  if (!kits.length) {
    return <p className="py-6 text-center text-sm text-gray-500">No kits yet. Pack one for a show and put someone on it to run the stall.</p>
  }
  const sorted = [...kits].sort((a, b) => (b.show?.show_date ?? '').localeCompare(a.show?.show_date ?? ''))
  return (
    <ul className="divide-y divide-brand-100 overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-sm">
      {sorted.map(k => {
        const kl = lines.filter(l => l.kit_id === k.id)
        const went = kl.reduce((n, l) => n + l.taken, 0)
        const sold = [...kitSoldByVariant(k.id, moves).values()].reduce((a, b) => a + b, 0)
        const money_in = Number(k.cash_in ?? 0) + Number(k.upi_in ?? 0) + Number(k.card_in ?? 0)
        return (
          <li key={k.id}>
            <Link href={`/merch/kits/${k.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-brand-50">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{k.show?.title ?? 'Deleted show'}</p>
                <p className="text-xs text-gray-500">
                  {[k.show?.show_date && formatDateDMY(k.show.show_date), nameOf(k.lead_id), `${sold} of ${went} sold`, k.status !== 'open' && money(money_in)].filter(Boolean).join(' · ')}
                </p>
              </div>
              <StatusPill tone={tone(k.status as KitStatus)}>{KIT_STATUS_LABELS[k.status as KitStatus] ?? k.status}</StatusPill>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
