'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { DEFAULT_FINANCE_SETTINGS, currencySymbol, formatMoney, type FinanceSettings } from '@/lib/finance/settings'
import type { FinanceProject } from '@/types/finance'

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
}

const FinanceExtrasContext = createContext<FinanceExtras>({ projects: [], knownTags: [] })

/** Projects and tags in use, for the add/edit entry form anywhere inside a Finance page. */
export function FinanceExtrasProvider({ projects, knownTags, children }: FinanceExtras & { children: ReactNode }) {
  return <FinanceExtrasContext.Provider value={{ projects, knownTags }}>{children}</FinanceExtrasContext.Provider>
}

export function useFinanceExtras() {
  return useContext(FinanceExtrasContext)
}
