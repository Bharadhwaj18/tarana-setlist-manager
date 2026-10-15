'use client'

import { formatMoney } from '@/lib/finance/settings'
import { CountUp } from './CountUp'

/** CountUp for a money figure. Takes the currency code, since a server page can't pass a formatter function. */
export function MoneyCountUp({ value, currency }: { value: number; currency: string }) {
  return <CountUp value={value} format={n => formatMoney(Math.round(n), currency)} />
}
