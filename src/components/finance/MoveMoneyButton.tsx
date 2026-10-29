'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRightLeft } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toaster'
import { useMoney } from '@/components/finance/FinanceSettingsContext'
import { moveMoney } from '@/actions/finance-transfers'
import { accountIdOf, accountValue, activeAccounts, type FinanceAccount } from '@/lib/finance/accounts'
import { validateMove } from '@/lib/finance/transfers'

interface Member { id: string; name: string; isYou?: boolean }

interface Props {
  accounts: FinanceAccount[]
  members: Member[]
  /** What each account holds, to show next to its name. Accounts missing here are listed without a figure. */
  balances?: Record<string, number>
  /** Start with this holder as the source ("acct:<id>" or a member id). */
  from?: string
  variant?: 'secondary' | 'ghost'
  className?: string
}

const inputCls = 'w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400'
const labelCls = 'mb-1.5 block text-xs font-bold text-gray-700'

/** "Move money": shift money between an account and another account or a member's pocket. Not income or spending. */
export function MoveMoneyButton({ accounts, members, balances, from, variant = 'secondary', className }: Props) {
  const { canChangeEntries } = useMoney()
  const [open, setOpen] = useState(false)
  const active = activeAccounts(accounts)
  // With approval on, only admins and treasurers change what counts, and moving money does.
  if (!canChangeEntries || active.length === 0) return null

  return (
    <>
      <Button type="button" variant={variant} size="sm" className={className} onClick={() => setOpen(true)}>
        <ArrowRightLeft className="h-4 w-4" />Move money
      </Button>
      <Modal open={open} onOpenChange={setOpen} title="Move money" className="max-w-[460px] rounded-2xl">
        {open && <MoveForm accounts={active} members={members} balances={balances ?? {}} from={from} onDone={() => setOpen(false)} />}
      </Modal>
    </>
  )
}

function MoveForm({ accounts, members, balances, from: fromProp, onDone }: { accounts: FinanceAccount[]; members: Member[]; balances: Record<string, number>; from?: string; onDone: () => void }) {
  const router = useRouter()
  const toast = useToast()
  const { money, symbol } = useMoney()
  const me = members.find(m => m.isYou)
  const first = fromProp ?? accountValue(accounts[0].id)
  // Default destination: the next account if there is one, otherwise the person moving it.
  const second = accounts.map(a => accountValue(a.id)).find(v => v !== first) ?? me?.id ?? ''
  const [from, setFrom] = useState(first)
  const [to, setTo] = useState(second)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()

  const holders = [
    ...accounts.map(a => ({ value: accountValue(a.id), label: balances[a.id] !== undefined ? `${a.name} · ${money(balances[a.id])}` : a.name })),
    ...members.map(m => ({ value: m.id, label: m.isYou ? 'My pocket' : `${m.name}’s pocket` })),
  ]
  const value = parseFloat(amount)
  const problem = validateMove(from, to, value)
  const fromAccount = accountIdOf(from)
  const short = fromAccount && balances[fromAccount] !== undefined && Number.isFinite(value) && value > balances[fromAccount]

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (problem) { toast(problem, 'error'); return }
    startTransition(async () => {
      const res = await moveMoney({ from, to, amount: value, note })
      if (res.error) { toast(res.error, 'error'); return }
      toast('Money moved', 'success')
      router.refresh()
      onDone()
    })
  }

  const select = (id: string, label: string, v: string, set: (v: string) => void) => (
    <div>
      <label htmlFor={id} className={labelCls}>{label}</label>
      <Select id={id} value={v} onChange={e => set(e.target.value)} className={inputCls}>
        {holders.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
      </Select>
    </div>
  )

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm leading-relaxed text-gray-600">For cash you put into the bank, or money you take out. It isn’t income or spending, so reports leave it out.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {select('move-from', 'From', from, setFrom)}
        {select('move-to', 'To', to, setTo)}
      </div>
      <div>
        <label htmlFor="move-amount" className={labelCls}>Amount</label>
        <div className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 focus-within:border-brand-400 focus-within:ring-1 focus-within:ring-brand-400">
          <span className="font-bold text-gray-500">{symbol}</span>
          <input id="move-amount" type="number" inputMode="decimal" min="0" step="any" autoFocus value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0" className="min-h-11 w-full bg-transparent text-sm font-bold text-gray-900 outline-none" />
        </div>
        {short && <p className="mt-1.5 text-xs font-semibold text-amber-800">That’s more than what’s recorded in this account. You can still move it; the balance will go below zero.</p>}
      </div>
      <div>
        <label htmlFor="move-note" className={labelCls}>Note <span className="font-normal text-gray-500">(optional)</span></label>
        <input id="move-note" value={note} maxLength={120} onChange={e => setNote(e.target.value)} placeholder="Deposited at the branch" className={inputCls} />
      </div>
      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="secondary" onClick={onDone}>Cancel</Button>
        <Button type="submit" loading={pending} disabled={!!problem}>{Number.isFinite(value) && value > 0 ? `Move ${money(value)}` : 'Move money'}</Button>
      </div>
    </form>
  )
}
