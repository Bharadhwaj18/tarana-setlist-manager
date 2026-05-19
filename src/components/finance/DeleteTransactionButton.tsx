'use client'

import { useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { deleteTransaction } from '@/actions/finance'
import { useToast } from '@/components/ui/Toaster'

export function DeleteTransactionButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  return (
    <button
      onClick={() => startTransition(async () => {
        const result = await deleteTransaction(id)
        if (result.error) toast(result.error, 'error')
      })}
      disabled={isPending}
      className="shrink-0 text-gray-200 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100 disabled:opacity-50"
      aria-label="Delete transaction"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )
}
