'use client'

import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { addTransaction } from '@/actions/finance'
import { useToast } from '@/components/ui/Toaster'

interface Member { id: string; name: string }

const inputCls = 'w-full rounded-md border border-brand-200 bg-white px-3 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400'

export function AddTransactionModal({ members }: { members: Member[] }) {
  const [open, setOpen] = useState(false)
  const [memberId, setMemberId] = useState(members[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [dir, setDir] = useState<'credit' | 'debit'>('credit')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  const reset = () => { setAmount(''); setDescription('') }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) return
    startTransition(async () => {
      const result = await addTransaction({
        member_id: memberId || null,
        amount: dir === 'credit' ? amt : -amt,
        description: description.trim() || (dir === 'credit' ? 'Credit' : 'Debit'),
        date,
      })
      if (result.error) {
        toast(result.error, 'error')
      } else {
        toast('Transaction added', 'success')
        setOpen(false)
        reset()
      }
    })
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Transaction
      </Button>

      <Modal open={open} onOpenChange={o => { setOpen(o); if (!o) reset() }} title="Record Transaction">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Credit / Debit */}
          <div className="flex gap-2">
            <button type="button" onClick={() => setDir('credit')}
              className={`flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${dir === 'credit' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              + Credit (add money)
            </button>
            <button type="button" onClick={() => setDir('debit')}
              className={`flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${dir === 'debit' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              − Debit (subtract)
            </button>
          </div>

          {/* Who */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">For</label>
            <select value={memberId} onChange={e => setMemberId(e.target.value)} className={inputCls}>
              {members.map(m => (
                <option key={m.id ?? 'fund'} value={m.id ?? ''}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Amount (₹)</label>
            <input type="number" min="0.01" step="any" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0" className={inputCls} autoFocus required />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Rehearsal space, Withdrawal" className={inputCls} />
          </div>

          {/* Date */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={isPending}>Add</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
