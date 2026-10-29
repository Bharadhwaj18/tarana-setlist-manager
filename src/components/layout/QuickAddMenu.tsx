'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, CalendarPlus, CheckSquare, ListMusic, Plus, Wallet, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toaster'
import { AddTransactionModal } from '@/components/finance/AddTransactionModal'
import { FinanceExtrasProvider, useMoney } from '@/components/finance/FinanceSettingsContext'
import { QuickTaskModal } from '@/components/tasks/QuickTaskModal'
import { QuickEventModal } from '@/components/calendar/QuickEventModal'
import { loadQuickAddData, type QuickAddData } from '@/actions/finance-quickadd'
import { QUICK_ADD_EVENT } from '@/lib/finance/quick-add-event'

/** What this person can add here (edit access to the section). */
export interface QuickAddAllowed { shows: boolean; setlists: boolean; finance: boolean; calendar: boolean; tasks: boolean }

// What the last open loaded, per workspace: reopening shows the forms at once and refreshes behind them.
const cache = new Map<string, QuickAddData>()
// One load at a time, shared by whoever asks.
let inflight: Promise<QuickAddData | { error: string }> | null = null

interface Item { key: string; label: string; icon: LucideIcon; href?: string; onPick?: () => void }

/**
 * The round "+" on phones: a list of the things you can add from anywhere (a show, a setlist, a transaction, a
 * calendar event, a task). Only what you're allowed to add is listed.
 */
export function QuickAddMenu({ allowed }: { allowed: QuickAddAllowed }) {
  const { workspaceId } = useMoney()
  const toast = useToast()
  const [menuOpen, setMenuOpen] = useState(false)
  const [money, setMoney] = useState(false)
  const [task, setTask] = useState(false)
  const [event, setEvent] = useState(false)
  const [loaded, setLoaded] = useState<QuickAddData | null>(null)

  // Data belongs to one workspace; after a switch, only that workspace's own copy counts.
  const data = loaded?.workspaceId === workspaceId ? loaded : cache.get(workspaceId) ?? null

  // Starts loading as soon as a finger lands, so the forms are ready by the time one is picked.
  const load = () => {
    inflight ??= loadQuickAddData()
      .catch((): { error: string } => ({ error: 'Couldn’t load the form. Check your connection and try again.' }))
      .finally(() => { inflight = null })
    return inflight.then(res => {
      if ('error' in res) return res.error
      cache.set(res.workspaceId, res)
      setLoaded(res)
      return null
    })
  }

  // The forms that need data open straight away; with a copy from earlier no signal doesn't stop them.
  const openWithData = (open: (v: boolean) => void) => {
    setMenuOpen(false)
    open(true)
    const haveCopy = !!data
    void load().then(error => {
      if (error && !haveCopy) { toast(error, 'error'); open(false) }
    })
  }

  const openMoney = () => openWithData(setMoney)

  // Other buttons on a page (like Today's "Log money") open the money form directly.
  useEffect(() => {
    window.addEventListener(QUICK_ADD_EVENT, openMoney)
    return () => window.removeEventListener(QUICK_ADD_EVENT, openMoney)
  })

  const items: Item[] = [
    allowed.shows && { key: 'show', label: 'Add show', icon: CalendarDays, href: '/shows/new' },
    allowed.setlists && { key: 'setlist', label: 'Add setlist', icon: ListMusic, href: '/setlists/new' },
    allowed.finance && { key: 'money', label: 'Add transaction', icon: Wallet, onPick: openMoney },
    allowed.calendar && { key: 'event', label: 'Add calendar event', icon: CalendarPlus, onPick: () => { setMenuOpen(false); setEvent(true) } },
    allowed.tasks && { key: 'task', label: 'Add task', icon: CheckSquare, onPick: () => openWithData(setTask) },
  ].filter(Boolean) as Item[]

  if (items.length === 0) return null

  return (
    <>
      <button
        type="button"
        onPointerDown={() => { void load() }}
        onClick={() => setMenuOpen(true)}
        aria-label="Add something"
        aria-haspopup="dialog"
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-400 text-white shadow-lg transition-colors hover:bg-brand-500 active:scale-95 lg:hidden"
      >
        <Plus className="h-7 w-7" />
      </button>

      <div className={cn('fixed inset-0 z-50 lg:hidden', menuOpen ? 'pointer-events-auto' : 'pointer-events-none')} aria-hidden={!menuOpen}>
        <div className={cn('absolute inset-0 bg-black/40 transition-opacity duration-300', menuOpen ? 'opacity-100' : 'opacity-0')} onClick={() => setMenuOpen(false)} />
        <div
          role="dialog"
          aria-label="Add something"
          className={cn(
            'absolute inset-x-0 bottom-0 rounded-t-3xl bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2 shadow-2xl transition-transform duration-300 ease-out',
            menuOpen ? 'translate-y-0' : 'translate-y-full',
          )}
        >
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300" />
          <h2 className="mb-2 px-1 font-display text-xl font-bold text-gray-900">Add</h2>
          <ul className="space-y-1">
            {items.map(({ key, label, icon: Icon, href, onPick }) => {
              const row = (
                <>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700"><Icon className="h-5 w-5" /></span>
                  <span className="text-base font-extrabold text-gray-900">{label}</span>
                </>
              )
              const cls = 'flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left hover:bg-brand-50 active:bg-brand-100'
              return (
                <li key={key}>
                  {href
                    ? <Link href={href} onClick={() => setMenuOpen(false)} className={cls}>{row}</Link>
                    : <button type="button" onClick={onPick} className={cls}>{row}</button>}
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      {(money || task) && !data && (
        <Modal open onOpenChange={v => { if (!v) { setMoney(false); setTask(false) } }} title="Opening…" className="max-w-[480px] rounded-2xl">
          <p role="status" className="py-10 text-center text-sm font-semibold text-gray-500">Opening…</p>
        </Modal>
      )}
      {data && allowed.finance && (
        <FinanceExtrasProvider projects={data.projects} knownTags={data.knownTags} accounts={data.accounts}>
          <AddTransactionModal open={money} onOpenChange={setMoney} members={data.members} shows={data.shows} budgets={data.budgets} />
        </FinanceExtrasProvider>
      )}
      {data && allowed.tasks && <QuickTaskModal boards={data.boards} members={data.members} open={task} onOpenChange={setTask} />}
      {allowed.calendar && <QuickEventModal open={event} onOpenChange={setEvent} />}
    </>
  )
}
