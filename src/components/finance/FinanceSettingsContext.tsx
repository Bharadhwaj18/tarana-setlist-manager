'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { DEFAULT_FINANCE_SETTINGS, currencySymbol, formatMoney, type FinanceSettings } from '@/lib/finance/settings'
import type { FinanceProject } from '@/types/finance'
import type { FinanceAccount } from '@/lib/finance/accounts'

const FinanceSettingsContext = createContext<{ settings: FinanceSettings; canApprove: boolean }>({ settings: DEFAULT_FINANCE_SETTINGS, canApprove: false })

/** Makes the current workspace's money settings available to every client component in the app. */
export function FinanceSettingsProvider({ settings, canApprove = false, children }: { settings: FinanceSettings; canApprove?: boolean; children: ReactNode }) {
  return <FinanceSettingsContext.Provider value={{ settings, canApprove }}>{children}</FinanceSettingsContext.Provider>
}

/** The money settings plus formatters in the workspace's currency. */
export function useMoney() {
  const { settings, canApprove } = useContext(FinanceSettingsContext)
  const money = (n: number) => formatMoney(n, settings.currency)
  const signed = (n: number) => `${n < 0 ? '−' : ''}${money(n)}`
  // With approval on, only admins and treasurers can change entries that already count.
  const canChangeEntries = !settings.features.approvals || canApprove
  return { settings, money, signed, symbol: currencySymbol(settings.currency), canApprove, canChangeEntries, needsApproval: settings.features.approvals && !canApprove }
}

interface FinanceExtras {
  projects: FinanceProject[]
  knownTags: string[]
  /** The workspace's accounts, when Band accounts is on. */
  accounts?: FinanceAccount[]
}

const FinanceExtrasContext = createContext<Required<FinanceExtras>>({ projects: [], knownTags: [], accounts: [] })

/** Projects, tags and accounts, for the add/edit entry form anywhere inside a Finance page. */
export function FinanceExtrasProvider({ projects, knownTags, accounts = [], children }: FinanceExtras & { children: ReactNode }) {
  return <FinanceExtrasContext.Provider value={{ projects, knownTags, accounts }}>{children}</FinanceExtrasContext.Provider>
}

export function useFinanceExtras() {
  return useContext(FinanceExtrasContext)
}
