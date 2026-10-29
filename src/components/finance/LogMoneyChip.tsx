'use client'

import { Wallet } from 'lucide-react'
import { openQuickAdd } from '@/lib/finance/quick-add-event'

/** "Log money" shortcut for the Today screen: opens the quick-add form without leaving the page. */
export function LogMoneyChip({ className }: { className?: string }) {
  return (
    <button type="button" onClick={openQuickAdd} className={className}>
      <Wallet className="h-4 w-4" /> Log money
    </button>
  )
}
