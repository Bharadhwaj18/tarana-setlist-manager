'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { requestBalanceReimbursement } from '@/actions/pending-payments'
import { useToast } from '@/components/ui/Toaster'

interface Props {
  memberId: string
  payers: { id: string; name: string }[]
}

export function ReimburseButton({ memberId, payers }: Props) {
  const [open, setOpen] = useState(false)
  const [payerId, setPayerId] = useState('')
  const [isPending, startTransition] = useTransition()
  const toast = useToast()
  const options = payers.filter(p => p.id !== memberId)

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-[11px] font-semibold text-brand-600 underline underline-offset-2">
        Reimburse
      </button>
    )
  }

  const submit = () => {
    startTransition(async () => {
      const result = await requestBalanceReimbursement(memberId, payerId)
      if (result.error) toast(result.error, 'error')
      else { toast('Reimbursement assigned', 'success'); setOpen(false); setPayerId('') }
    })
  }

  return (
    <div className="mt-1.5 flex items-center gap-2">
      <select
        value={payerId}
        onChange={e => setPayerId(e.target.value)}
        className="compact-field min-w-0 flex-1 rounded-md border border-brand-200 bg-white px-2 py-1.5 text-[11px]"
      >
        <option value="">Who pays?</option>
        {options.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <Button size="sm" loading={isPending} disabled={!payerId} onClick={submit}>Assign</Button>
      <button type="button" onClick={() => setOpen(false)} className="text-[11px] text-gray-400">Cancel</button>
    </div>
  )
}
