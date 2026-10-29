'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, ArchiveRestore, Banknote, Landmark, Plus, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { useToast } from '@/components/ui/Toaster'
import { cn } from '@/lib/utils'
import { createAccount, deleteAccount, setAccountArchived, updateAccount } from '@/actions/finance-accounts'
import { MAX_ACCOUNTS, type AccountKind, type FinanceAccount } from '@/lib/finance/accounts'
import { formatMoney as formatMoneyIn } from '@/lib/finance/settings'

interface Person { id: string; name: string }

interface Props {
  accounts: FinanceAccount[]
  members: Person[]
  /** Balance and number of entries per account, so we can say what can be deleted. */
  balances: Record<string, number>
  entryCounts: Record<string, number>
  currency: string
}

const card = 'rounded-2xl border border-brand-200 bg-white p-5 shadow-sm'

/** Make, edit, archive and delete accounts. Owners and admins only; the page only shows it to them. */
export function AccountsManager({ accounts, members, balances, entryCounts, currency }: Props) {
  const formatMoney = (n: number) => formatMoneyIn(n, currency)
  const router = useRouter()
  const toast = useToast()
  const [sheet, setSheet] = useState<{ account: FinanceAccount | null } | null>(null)
  const [pending, startTransition] = useTransition()
  const active = accounts.filter(a => !a.archived)
  const archived = accounts.filter(a => a.archived)
  const atLimit = active.length >= MAX_ACCOUNTS

  const run = (fn: () => Promise<{ error?: string }>, done: string) => startTransition(async () => {
    const res = await fn()
    if (res.error) { toast(res.error, 'error'); return }
    toast(done, 'success')
    router.refresh()
  })

  const remove = (a: FinanceAccount) => {
    if (!window.confirm(`Delete the “${a.name}” account? This can’t be undone.`)) return
    run(() => deleteAccount(a.id), 'Account deleted')
  }

  const row = (a: FinanceAccount) => {
    const Icon = a.kind === 'cash' ? Banknote : Landmark
    const count = entryCounts[a.id] ?? 0
    const holder = a.heldBy ? members.find(m => m.id === a.heldBy)?.name ?? 'a member' : null
    return (
      <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700"><Icon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-extrabold text-gray-900">{a.name}</p>
          <p className="truncate text-xs font-semibold text-gray-500">
            {holder ? `Held by ${holder}` : 'Held by the band'} · {formatMoney(balances[a.id] ?? 0)} · {count} {count === 1 ? 'entry' : 'entries'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="secondary" size="sm" onClick={() => setSheet({ account: a })} disabled={pending}>Edit</Button>
          <button type="button" disabled={pending || (a.archived && atLimit)} onClick={() => run(() => setAccountArchived(a.id, !a.archived), a.archived ? 'Account brought back' : 'Account archived')}
            aria-label={a.archived ? `Bring back ${a.name}` : `Archive ${a.name}`} title={a.archived && atLimit ? `You already have ${MAX_ACCOUNTS} accounts. Archive another first.` : undefined}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-brand-50 hover:text-gray-800 disabled:opacity-40">
            {a.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          </button>
          <button type="button" disabled={pending || count > 0} onClick={() => remove(a)} aria-label={`Delete ${a.name}`}
            title={count > 0 ? 'It has entries, so it can’t be deleted. Archive it instead.' : undefined}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </li>
    )
  }

  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-gray-900">Accounts</h2>
          <p className="mt-0.5 text-sm text-gray-500">Where the band’s money actually is. {active.length} of {MAX_ACCOUNTS} used.</p>
        </div>
        <Button type="button" size="sm" onClick={() => setSheet({ account: null })} disabled={atLimit || pending}>
          <Plus className="h-4 w-4" />New account
        </Button>
      </div>
      {atLimit && <p className="mt-2 text-xs font-semibold text-amber-800">That’s the most you can have. Archive one to make room.</p>}

      {active.length === 0 ? (
        <p className="mt-4 rounded-xl border-2 border-dashed border-brand-200 p-4 text-center text-sm text-gray-600">
          No accounts yet. A new account starts at {formatMoney(0)}; money gets in through entries.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-brand-100">{active.map(row)}</ul>
      )}

      {archived.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-gray-500">Archived</p>
          <ul className="mt-1 divide-y divide-brand-100 opacity-80">{archived.map(row)}</ul>
        </div>
      )}

      <AccountSheet open={!!sheet} account={sheet?.account ?? null} members={members} onOpenChange={o => { if (!o) setSheet(null) }} />
    </section>
  )
}

function AccountSheet({ open, account, members, onOpenChange }: { open: boolean; account: FinanceAccount | null; members: Person[]; onOpenChange: (open: boolean) => void }) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={account ? 'Edit account' : 'New account'} className="max-w-[460px] rounded-2xl">
      {open && <AccountForm account={account} members={members} onDone={() => onOpenChange(false)} />}
    </Modal>
  )
}

function AccountForm({ account, members, onDone }: { account: FinanceAccount | null; members: Person[]; onDone: () => void }) {
  const router = useRouter()
  const toast = useToast()
  const [kind, setKind] = useState<AccountKind>(account?.kind ?? 'bank')
  const [name, setName] = useState(account?.name ?? '')
  const [heldBy, setHeldBy] = useState<string | null>(account?.heldBy ?? null)
  const [upi, setUpi] = useState(account?.upiId ?? '')
  const [pending, startTransition] = useTransition()

  const save = () => {
    if (!name.trim()) { toast('Give the account a name, like Band account.', 'error'); return }
    startTransition(async () => {
      const input = { name, kind, heldBy, upiId: upi }
      const res = account ? await updateAccount(account.id, input) : await createAccount(input)
      if (res.error) { toast(res.error, 'error'); return }
      toast(account ? 'Account saved' : 'Account created', 'success')
      router.refresh()
      onDone()
    })
  }

  const field = 'min-h-12 w-full rounded-xl border border-brand-200 bg-white px-3 text-[15px] font-bold text-gray-900 placeholder-gray-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/30'
  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Type" className="flex rounded-xl bg-brand-100/70 p-1">
        {([['bank', 'Bank account'], ['cash', 'Cash']] as const).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)}
            className={cn('min-h-10 flex-1 rounded-lg text-sm font-extrabold', kind === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600')}>{label}</button>
        ))}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="account-name" className="text-xs font-extrabold text-gray-500">Name</label>
        <input id="account-name" autoFocus={!account} value={name} maxLength={40} onChange={e => setName(e.target.value)} placeholder={kind === 'cash' ? 'Cash box' : 'Band account'} className={field} />
      </div>

      <div role="radiogroup" aria-label="Whose name is it in?" className="space-y-2">
        <p className="text-xs font-extrabold text-gray-500">{kind === 'cash' ? 'Who carries it?' : 'Whose name is it in?'}</p>
        {[{ id: null as string | null, name: 'The band' }, ...members].map(m => {
          const on = heldBy === m.id
          return (
            <button key={m.id ?? 'band'} type="button" role="radio" aria-checked={on} onClick={() => setHeldBy(m.id)}
              className={cn('flex min-h-12 w-full items-center gap-3 rounded-xl border-[1.5px] px-3 text-left', on ? 'border-brand-600 bg-brand-50' : 'border-brand-200 bg-white hover:bg-brand-50/50')}>
              {m.id ? <UserAvatar name={m.name} id={m.id} size={28} /> : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-brand-700"><Landmark className="h-4 w-4" /></span>}
              <span className="flex-1 truncate font-extrabold text-gray-900">{m.name}</span>
              <span className={cn('flex h-5 w-5 items-center justify-center rounded-full border-2', on ? 'border-brand-600' : 'border-gray-300')}>{on && <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />}</span>
            </button>
          )
        })}
      </div>

      {!account && <p className="rounded-xl border border-brand-200 bg-brand-50/60 px-3 py-2.5 text-xs font-semibold text-gray-600">It starts at zero. Money gets in through entries (a show fee, a top-up). Nothing is imported from today’s balances.</p>}

      {kind === 'bank' && (
        <div className="space-y-1.5">
          <label htmlFor="account-upi" className="text-xs font-extrabold text-gray-500">UPI ID <span className="font-semibold text-gray-400">(optional)</span></label>
          <input id="account-upi" value={upi} maxLength={80} onChange={e => setUpi(e.target.value)} placeholder="band@okhdfc" className={field} />
          <p className="text-xs text-gray-500">Shown so people know where to send. The app never moves money.</p>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="secondary" onClick={onDone}>Cancel</Button>
        <Button type="button" onClick={save} loading={pending}>{account ? 'Save' : 'Create account'}</Button>
      </div>
    </div>
  )
}
