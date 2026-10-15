'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Clock, X } from 'lucide-react'
import { approveFinanceRequest, rejectFinanceRequest, withdrawFinanceRequest } from '@/actions/finance'
import { useMoney } from '@/components/finance/FinanceSettingsContext'
import { categoryLabel } from '@/lib/finance/settings'
import { useToast } from '@/components/ui/Toaster'
import { cn } from '@/lib/utils'
import type { FinanceRequest } from '@/types/finance'

interface Props {
  requests: FinanceRequest[]
  nameById: Record<string, string>
  showTitleById: Record<string, string>
  currentUserId: string
}

function shortDate(iso: string) {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(iso + 'T00:00:00Z'))
}

/**
 * Entries waiting for an admin or treasurer. They approve or turn them down here; anyone else sees
 * only their own, and can take one back before it's decided.
 */
export function FinanceRequests({ requests, nameById, showTitleById, currentUserId }: Props) {
  const { money, settings, canApprove } = useMoney()
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [gone, setGone] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()

  if (requests.length === 0) return null

  const run = (id: string, fn: () => Promise<{ error?: string }>, done: string) => {
    setBusy(id)
    startTransition(async () => {
      const res = await fn()
      setBusy(null)
      if (res.error) { toast(res.error, 'error'); return }
      setRejecting(null)
      setReason('')
      toast(done, 'success')
      // The card fades out, then the refreshed list drops it.
      setGone(prev => new Set(prev).add(id))
      window.setTimeout(() => router.refresh(), 220)
    })
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm dark:bg-amber-500/5">
      <h2 className="mb-3 flex items-center gap-2 font-sans text-sm font-extrabold text-gray-900">
        <Clock className="h-4 w-4 text-amber-600" />
        {canApprove ? `Waiting for your approval (${requests.length})` : `Waiting for approval (${requests.length})`}
      </h2>
      <ul className="space-y-2">
        {requests.map(r => {
          const isIn = r.amount > 0
          const mine = r.submitted_by === currentUserId
          return (
            <li key={r.id} className={cn('animate-row-in rounded-xl border border-brand-200 bg-white p-3', busy === r.id && 'opacity-60', gone.has(r.id) && 'animate-row-out')}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-bold text-gray-900">{r.description}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {[mine ? 'You' : nameById[r.submitted_by] ?? 'Someone', categoryLabel(settings, r.category), r.show_id ? showTitleById[r.show_id] : null, shortDate(r.date)].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <span className={cn('shrink-0 text-base font-extrabold tabular-nums', isIn ? 'text-brand-600 dark:text-emerald-400' : 'text-red-700')}>{isIn ? '+' : '−'}{money(r.amount)}</span>
              </div>

              {canApprove ? (
                rejecting === r.id ? (
                  <div className="mt-3 space-y-2">
                    <input value={reason} onChange={e => setReason(e.target.value)} autoFocus maxLength={200} placeholder="Why? (optional, they’ll see this)" aria-label="Reason"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400" />
                    <div className="flex gap-2">
                      <button type="button" disabled={busy === r.id} onClick={() => run(r.id, () => rejectFinanceRequest(r.id, reason), 'Turned down')}
                        className="min-h-11 flex-1 rounded-xl bg-red-600 text-sm font-extrabold text-white hover:bg-red-700">Turn down</button>
                      <button type="button" onClick={() => { setRejecting(null); setReason('') }} className="min-h-11 rounded-xl px-4 text-sm font-bold text-gray-600 hover:bg-brand-50">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <button type="button" disabled={busy === r.id} onClick={() => run(r.id, () => approveFinanceRequest(r.id), 'Approved')}
                      className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-400 text-sm font-extrabold text-white hover:bg-brand-500">
                      <Check className="h-4 w-4" /> Approve
                    </button>
                    <button type="button" disabled={busy === r.id} onClick={() => setRejecting(r.id)}
                      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-brand-200 bg-white px-4 text-sm font-bold text-gray-700 hover:bg-brand-50">
                      <X className="h-4 w-4" /> Not approved
                    </button>
                  </div>
                )
              ) : mine && (
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-amber-700">Waiting for an admin or treasurer</span>
                  <button type="button" disabled={busy === r.id} onClick={() => run(r.id, () => withdrawFinanceRequest(r.id), 'Taken back')}
                    className="min-h-9 rounded-lg px-3 text-xs font-bold text-gray-600 hover:bg-brand-50">Take back</button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
