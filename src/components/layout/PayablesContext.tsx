'use client'

import { createContext, useContext, type ReactNode } from 'react'

/** A payment this person still owes, with its amount already written out in the workspace's currency. */
export interface Payable { id: string; amountText: string }

const PayablesContext = createContext<Payable[]>([])

/** Lets the notification bell offer "Mark paid" on a "You owe" notification, without opening Finance. */
export function PayablesProvider({ payables, children }: { payables: Payable[]; children: ReactNode }) {
  return <PayablesContext.Provider value={payables}>{children}</PayablesContext.Provider>
}

export const usePayables = () => useContext(PayablesContext)

/** The payment a notification is about: its link looks like /finance?pay=<id>. Null for any other link. */
export function paymentIdFromLink(link: string | null): string | null {
  if (!link) return null
  const q = link.split('?')[1]
  return q ? new URLSearchParams(q).get('pay') : null
}
