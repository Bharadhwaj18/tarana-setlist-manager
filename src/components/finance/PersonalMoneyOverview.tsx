'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { useToast } from '@/components/ui/Toaster'
import { DEBIT_TEXT, fmt, fmtSigned } from '@/components/finance/money'
import { useSwitchWorkspace } from '@/components/layout/useSwitchWorkspace'
import { markPendingPaymentPaid } from '@/actions/pending-payments'
import { totalsByCurrency } from '@/lib/finance/overview'
import { cn } from '@/lib/utils'
import type { PersonalFinance, PersonalPayment } from '@/lib/data'

const card = 'rounded-2xl border border-brand-200 bg-white p-5 shadow-sm'

/** Personal's finance front page: your own money in each workspace, and what you owe or are owed. Read-only; entries are made inside a workspace. */
export function PersonalMoneyOverview({ data, currentId }: { data: PersonalFinance; currentId: string }) {
  const router = useRouter()
  const toast = useToast()
  const { pending: switching, switchTo } = useSwitchWorkspace()
  const [paying, startPaying] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)

  const { holdings, owe, owed } = data
  if (holdings.length === 0) return null
  const totals = totalsByCurrency(holdings)

  const markPaid = (p: PersonalPayment) => {
    setBusy(p.id)
    startPaying(async () => {
      const res = await markPendingPaymentPaid(p.id)
      setBusy(null)
      if (res.error) { toast(res.error, 'error'); return }
      toast('Marked as paid', 'success')
      router.refresh()
    })
  }

  const list = (items: PersonalPayment[], verb: 'to' | 'from', action: string) => (
    <ul className="divide-y divide-brand-100">
      {items.map(p => (
        <li key={p.id} className="flex items-center gap-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-gray-900">{verb === 'to' ? 'To' : 'From'} {p.otherName}</p>
            <p className="truncate text-xs text-gray-500">{p.workspaceName} · {p.description}</p>
          </div>
          <span className="shrink-0 text-sm font-extrabold tabular-nums text-gray-900">{fmt(p.amount, p.currency)}</span>
          <Button size="sm" variant="secondary" loading={paying && busy === p.id} disabled={paying} onClick={() => markPaid(p)}>{action}</Button>
        </li>
      ))}
    </ul>
  )

  return (
    <div className="space-y-4">
      <section aria-label="Your money across workspaces" className={card}>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <SectionLabel>Your money across workspaces</SectionLabel>
          {totals.length === 1 && holdings.length > 1 && (
            <span className={cn('text-sm font-extrabold tabular-nums', totals[0].total < 0 ? DEBIT_TEXT : 'text-gray-900')}>{fmtSigned(totals[0].total, totals[0].currency)}</span>
          )}
        </div>
        <ul className="-mx-2 divide-y divide-brand-100">
          {holdings.map(h => (
            <li key={h.workspaceId}>
              <button type="button" disabled={switching} onClick={() => switchTo(h.workspaceId, currentId, '/finance')}
                className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-brand-50">
                <span className="min-w-0 flex-1 truncate text-sm font-extrabold text-gray-900">{h.name}</span>
                <span className={cn('shrink-0 text-base font-extrabold tabular-nums', h.balance < 0 ? DEBIT_TEXT : 'text-gray-900')}>{fmtSigned(h.balance, h.currency)}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-gray-500">What you hold in each workspace. Tap one to open its Finance.</p>
      </section>

      {owe.length > 0 && (
        <section aria-label="You owe" className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <SectionLabel className="mb-1">You owe</SectionLabel>
          {list(owe, 'to', 'Mark paid')}
        </section>
      )}
      {owed.length > 0 && (
        <section aria-label="Owed to you" className={card}>
          <SectionLabel className="mb-1">Owed to you</SectionLabel>
          {list(owed, 'from', 'I got it')}
        </section>
      )}
    </div>
  )
}
