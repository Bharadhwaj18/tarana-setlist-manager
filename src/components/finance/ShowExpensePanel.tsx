'use client'

import { useState, useTransition } from 'react'
import { X, Plus } from 'lucide-react'
import { addShowExpense, deleteShowExpense } from '@/actions/finance'
import { useToast } from '@/components/ui/Toaster'
import type { FinanceShowExpense } from '@/types/finance'

interface Member { id: string; name: string }

interface Props {
  showId: string
  grossIncome: number
  initialExpenses: FinanceShowExpense[]
  members: Member[]
  disabled?: boolean
  onExpensesChange: (showId: string, expenses: FinanceShowExpense[]) => void
}

const CATEGORIES = ['travel', 'food', 'equipment', 'venue', 'misc'] as const
const inputCls = 'rounded-md border border-brand-200 bg-white px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400'

function fmt(n: number) {
  return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export function ShowExpensePanel({ showId, grossIncome, initialExpenses, members, disabled, onExpensesChange }: Props) {
  const [expenses, setExpenses] = useState<FinanceShowExpense[]>(initialExpenses)
  const [showForm, setShowForm] = useState(false)
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [paidBy, setPaidBy] = useState(members[0]?.id ?? '')
  const [category, setCategory] = useState<string>('misc')
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const net = grossIncome - totalExpenses

  const update = (next: FinanceShowExpense[]) => {
    setExpenses(next)
    onExpensesChange(showId, next)
  }

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!amt || amt <= 0 || !desc.trim()) return

    const tempId = `temp-${Date.now()}`
    const now = new Date().toISOString()
    const today = now.slice(0, 10)
    const optimistic: FinanceShowExpense = {
      id: tempId,
      show_id: showId,
      description: desc.trim(),
      amount: amt,
      paid_by: paidBy,
      category,
      date: today,
      recorded_by: '',
      created_at: now,
    }

    const next = [...expenses, optimistic]
    update(next)
    setDesc('')
    setAmount('')
    setShowForm(false)

    startTransition(async () => {
      const result = await addShowExpense(showId, {
        description: optimistic.description,
        amount: optimistic.amount,
        paid_by: paidBy,
        category,
        date: today,
      })
      if (result.error) {
        toast(result.error, 'error')
        update(expenses)
      } else if (result.id) {
        update(next.map(x => x.id === tempId ? { ...x, id: result.id! } : x))
      }
    })
  }

  const handleDelete = (id: string) => {
    const prev = expenses
    const next = expenses.filter(e => e.id !== id)
    update(next)
    startTransition(async () => {
      const result = await deleteShowExpense(id)
      if (result.error) {
        toast(result.error, 'error')
        update(prev)
      }
    })
  }

  return (
    <div className="border-t border-brand-100 px-4 pb-3 pt-2.5">
      {expenses.length > 0 && (
        <div className="mb-2 space-y-1">
          {expenses.map(exp => {
            const payer = members.find(m => m.id === exp.paid_by)
            return (
              <div key={exp.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1 text-gray-600">
                  {exp.description}
                  {payer && <span className="ml-1 text-xs text-gray-400">({payer.name})</span>}
                </span>
                <span className="font-medium text-red-600">−{fmt(exp.amount)}</span>
                {!disabled && (
                  <button
                    onClick={() => handleDelete(exp.id)}
                    disabled={isPending || exp.id.startsWith('temp-')}
                    className="text-gray-300 hover:text-red-400 disabled:opacity-40"
                    aria-label="Remove expense"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showForm && !disabled ? (
        <form onSubmit={handleAdd} className="mb-2 rounded-lg bg-gray-50 p-3">
          <div className="mb-2 grid grid-cols-2 gap-2">
            <input
              type="text"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Description (e.g. Travel)"
              className={`col-span-2 ${inputCls}`}
              autoFocus
              required
            />
            <input
              type="number"
              min="1"
              step="any"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="Amount ₹"
              className={inputCls}
              required
            />
            <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls}>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>
          <div className="mb-2">
            <select value={paidBy} onChange={e => setPaidBy(e.target.value)} className={`w-full ${inputCls}`}>
              {members.map(m => <option key={m.id} value={m.id}>{m.name} paid</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending || !desc.trim() || !amount}
              className="flex items-center gap-1 rounded-md bg-brand-400 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setDesc(''); setAmount('') }}
              className="rounded-md px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        !disabled && (
          <button
            onClick={() => setShowForm(true)}
            className="mb-2 flex items-center gap-1 text-xs text-brand-500 hover:text-brand-700"
          >
            <Plus className="h-3 w-3" /> Add expense
          </button>
        )
      )}

      <div className="flex items-center justify-between border-t border-brand-100 pt-2 text-sm">
        {totalExpenses > 0 && (
          <span className="text-xs text-gray-400">expenses: −{fmt(totalExpenses)}</span>
        )}
        <span className={`ml-auto font-semibold ${net < grossIncome ? 'text-brand-700' : 'text-gray-700'}`}>
          Net: {fmt(net)}
        </span>
      </div>
    </div>
  )
}
