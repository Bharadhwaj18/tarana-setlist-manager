import { formatMoney } from '@/lib/finance/settings'

/** Whole-unit amount in the workspace currency (rupees when none is given). Client components use useMoney() instead. */
export function fmt(n: number, currency: string = 'INR') {
  return formatMoney(n, currency)
}

export function fmtSigned(n: number, currency: string = 'INR') {
  return `${n < 0 ? '−' : ''}${fmt(n, currency)}`
}

/** Money in is the forest green in light mode and the small green accent in dark; money out is red. */
export const CREDIT_TEXT = 'text-brand-400 dark:text-emerald-400'
export const DEBIT_TEXT = 'text-red-700'
export const BAR_FILL = 'bg-brand-400 dark:bg-emerald-400'
