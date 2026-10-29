'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toaster'
import { AddTransactionModal } from '@/components/finance/AddTransactionModal'
import { FinanceExtrasProvider, useMoney } from '@/components/finance/FinanceSettingsContext'
import { loadQuickAddData, type QuickAddData } from '@/actions/finance-quickadd'
import { QUICK_ADD_EVENT } from '@/lib/finance/quick-add-event'

// What the last open loaded, per workspace: reopening shows the form at once and refreshes behind it.
const cache = new Map<string, QuickAddData>()

/**
 * A round "+" on phones that opens the add-money form from any page, so logging money isn't a trip into Finance.
 * Finance pages already have their own add button, so it steps aside there.
 */
export function QuickAddMoney() {
  const { workspaceId } = useMoney()
  const pathname = usePathname()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState<QuickAddData | null>(null)
  const inflight = useRef<Promise<string | null> | null>(null)

  // Data belongs to one workspace; after a switch, only that workspace's own copy counts.
  const data = loaded?.workspaceId === workspaceId ? loaded : cache.get(workspaceId) ?? null

  // Starts loading as soon as a finger lands, so the form is usually ready by the time the tap finishes.
  const load = () => {
    if (!inflight.current) {
      inflight.current = loadQuickAddData()
        .then(res => {
          if ('error' in res) return res.error
          cache.set(res.workspaceId, res)
          setLoaded(res)
          return null
        })
        .catch(() => 'Couldn’t load the form. Check your connection and try again.')
        .finally(() => { inflight.current = null })
    }
    return inflight.current
  }

  const openForm = () => {
    setOpen(true)
    // With a copy from earlier the form opens anyway, so no signal doesn't stop someone logging an entry.
    const haveCopy = !!data
    void load().then(error => {
      if (error && !haveCopy) { toast(error, 'error'); setOpen(false) }
    })
  }

  // Other buttons on the page (like Today's "Log money") open the same form.
  useEffect(() => {
    window.addEventListener(QUICK_ADD_EVENT, openForm)
    return () => window.removeEventListener(QUICK_ADD_EVENT, openForm)
  })

  if (pathname.startsWith('/finance')) return null

  return (
    <>
      <button
        type="button"
        onPointerDown={() => { void load() }}
        onClick={openForm}
        aria-label="Add money in or out"
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-400 text-white shadow-lg transition-colors hover:bg-brand-500 active:scale-95 lg:hidden"
      >
        <Plus className="h-7 w-7" />
      </button>

      {open && !data && (
        <Modal open onOpenChange={setOpen} title="Add money in or out" className="max-w-[480px] rounded-2xl">
          <p role="status" className="py-10 text-center text-sm font-semibold text-gray-500">Opening…</p>
        </Modal>
      )}
      {data && (
        <FinanceExtrasProvider projects={data.projects} knownTags={data.knownTags} accounts={data.accounts}>
          <AddTransactionModal open={open} onOpenChange={setOpen} members={data.members} shows={data.shows} budgets={data.budgets} />
        </FinanceExtrasProvider>
      )}
    </>
  )
}
