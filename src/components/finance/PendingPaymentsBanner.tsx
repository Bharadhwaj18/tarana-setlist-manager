'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { markPendingPaymentPaid } from '@/actions/pending-payments'
import { useToast } from '@/components/ui/Toaster'
import { fmt } from './money'
import type { PendingPayment } from '@/types'

interface Props {
  /** Already filtered to the current user's own pending payments (from_member === them). */
  payments: PendingPayment[]
  profiles: { id: string; display_name: string | null }[]
}

/**
 * A standing reminder for whatever this person still owes a bandmate from
 * a confirmed split — shown until they mark it paid, at which point it
 * becomes a real Band Fund debit (see markPendingPaymentPaid). No push
 * notifications here — this banner (plus the Sidebar badge) is the
 * reminder, and it's there every time they open the app until it's dealt
 * with.
 */
export function PendingPaymentsBanner({ payments, profiles }: Props) {
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  // A plain function prop isn't serializable across the server/client
  // boundary — pass the raw profiles instead and resolve names in here
  // (same fix as SplitHistoryList's identical issue).
  const nameOf = (id: string) => profiles.find(p => p.id === id)?.display_name ?? 'Member'

  if (payments.length === 0) return null

  const handleMarkPaid = (ids: string[]) => {
    startTransition(async () => {
      for (const id of ids) {
        const result = await markPendingPaymentPaid(id)
        if (result.error) { toast(result.error, 'error'); return }
      }
      toast('Marked as paid', 'success')
    })
  }

  // One row per recipient — everything this person owes the same bandmate
  // is paid in one go, with the breakdown kept visible underneath.
  const groups = [...new Set(payments.map(p => p.to_member))].map(to => {
    const items = payments.filter(p => p.to_member === to)
    return { to, items, total: round2(items.reduce((s, p) => s + p.amount, 0)) }
  })

  const total = round2(payments.reduce((s, p) => s + p.amount, 0))

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
      <h2 className="mb-3 font-sans text-sm font-extrabold">
        You owe {fmt(total)} · {groups.length} pending payment{groups.length !== 1 ? 's' : ''}
      </h2>
      <div className="space-y-2">
        {groups.map(g => (
          <div key={g.to} className="rounded-xl bg-white px-3.5 py-3 text-gray-800">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-bold">{nameOf(g.to)}</p>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-sm font-extrabold tabular-nums">{fmt(g.total)}</span>
                <Button size="sm" loading={isPending} onClick={() => handleMarkPaid(g.items.map(p => p.id))}>Mark paid</Button>
              </div>
            </div>
            <div className="mt-1 space-y-0.5">
              {g.items.map(p => (
                <div key={p.id} className="flex items-baseline justify-between gap-3 text-xs text-gray-500">
                  <span className="min-w-0 truncate">
                    {p.category === 'balance_reimbursement' ? 'Balance reimbursement' : p.description}
                  </span>
                  <span className="shrink-0 tabular-nums">{fmt(p.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}
