export function fmt(n: number) {
  return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export function fmtSigned(n: number) {
  return `${n < 0 ? '−' : ''}${fmt(n)}`
}

/** Money in is the forest green in light mode and the small green accent in dark; money out is red. */
export const CREDIT_TEXT = 'text-brand-400 dark:text-emerald-400'
export const DEBIT_TEXT = 'text-red-700'
export const BAR_FILL = 'bg-brand-400 dark:bg-emerald-400'
