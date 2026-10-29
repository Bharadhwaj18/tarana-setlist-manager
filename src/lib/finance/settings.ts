/**
 * A workspace's money settings, stored at workspaces.settings -> 'finance' and changed only by admins.
 * Every field has a default that matches how Finance worked before it was configurable, so a workspace
 * that never opens the settings sees no difference.
 */

export type MoneyDirection = 'in' | 'out'

export interface FinanceCategory {
  /** What's saved on each entry. Never changes once created, so renaming a category keeps history intact. */
  key: string
  label: string
  direction: MoneyDirection
  /** Hidden categories stay on old entries but aren't offered for new ones. */
  hidden?: boolean
}

/** A percentage taken off the top of every show before anything else, paid to one member (e.g. a manager). */
export interface OffTopCut {
  id: string
  label: string
  memberId: string
  percent: number
}

export interface FinanceFeatures {
  projects: boolean
  recurring: boolean
  receivables: boolean
  tds: boolean
  /** Entries from anyone but admins and treasurers wait for one of them to approve. */
  approvals: boolean
  /** Real accounts (a band bank account, a cash box) next to members. Off by default. */
  accounts: boolean
}

export type ShareMode = 'equal' | 'percent' | 'ratio' | 'fixed'

export interface FinanceSettings {
  fundName: string
  currency: CurrencyCode
  categories: FinanceCategory[]
  /** Default share of each show kept in the shared fund. Can still be changed on each split. */
  fundPercent: number
  /**
   * How what's left after cuts and the fund is shared among the people who played:
   * 'equal' the same each; 'percent' a percentage each (adds up to 100); 'ratio' parts each, e.g. 2 : 1;
   * 'fixed' a set amount each, with whatever is left going to the fund.
   */
  shareMode: ShareMode
  /** Ratio parts per member, for 'ratio'. Anyone missing has 1. (Saved as "shares" before ratios were named.) */
  shares: Record<string, number>
  /** Percent per member, for 'percent'. Anyone missing has 0. */
  percents: Record<string, number>
  /** Fixed amount per show per member, for 'fixed'. Anyone missing gets 0. */
  fixedAmounts: Record<string, number>
  cuts: OffTopCut[]
  tags: string[]
  features: FinanceFeatures
}

// Categories with behaviour attached. They can be renamed but never removed.
export const REIMBURSEMENT_KEY = 'reimbursement'
export const SPLIT_KEY = 'split'
export const BALANCE_TOP_UP_KEY = 'balance_reimbursement'
/** Money moved between an account and another account or a pocket. Neither income nor spending. */
export const TRANSFER_KEY = 'transfer'
/** A fix that brings an account in line with the bank after a balance check. Neither income nor spending. */
export const CORRECTION_KEY = 'correction'
/** Money moved to members when shows are split. Not income or spending, so reports list it separately. */
export const PAYOUT_KEYS = new Set([SPLIT_KEY, BALANCE_TOP_UP_KEY])
const LOCKED_KEYS = new Set([REIMBURSEMENT_KEY, 'misc'])

export const DEFAULT_CATEGORIES: FinanceCategory[] = [
  { key: 'show_fee', label: 'Show fee', direction: 'in' },
  { key: 'sponsorship', label: 'Sponsorship', direction: 'in' },
  { key: 'merch', label: 'Merch', direction: 'in' },
  { key: 'member_contribution', label: 'Member contribution', direction: 'in' },
  { key: 'misc', label: 'Misc', direction: 'in' },
  { key: 'travel', label: 'Travel', direction: 'out' },
  { key: 'food', label: 'Food', direction: 'out' },
  { key: 'equipment', label: 'Equipment', direction: 'out' },
  { key: 'venue', label: 'Venue', direction: 'out' },
  { key: 'media', label: 'Media', direction: 'out' },
  { key: 'sound', label: 'Sound', direction: 'out' },
  { key: REIMBURSEMENT_KEY, label: 'Reimbursement', direction: 'out' },
  { key: 'misc', label: 'Misc', direction: 'out' },
]

export const DEFAULT_FINANCE_SETTINGS: FinanceSettings = {
  fundName: 'Band Fund',
  currency: 'INR',
  categories: DEFAULT_CATEGORIES,
  fundPercent: 20,
  shareMode: 'equal',
  shares: {},
  percents: {},
  fixedAmounts: {},
  cuts: [],
  tags: [],
  features: { projects: true, recurring: true, receivables: true, tds: true, approvals: false, accounts: false },
}

export function isLockedCategory(c: Pick<FinanceCategory, 'key'>) {
  return LOCKED_KEYS.has(c.key)
}

// Currency ------------------------------------------------------------------------------

export const CURRENCIES = [
  { code: 'INR', label: 'Indian rupee (₹)', locale: 'en-IN', pdfPrefix: 'Rs. ' },
  { code: 'USD', label: 'US dollar ($)', locale: 'en-US', pdfPrefix: '$' },
  { code: 'EUR', label: 'Euro (€)', locale: 'en-IE', pdfPrefix: 'EUR ' },
  { code: 'GBP', label: 'British pound (£)', locale: 'en-GB', pdfPrefix: 'GBP ' },
  { code: 'AUD', label: 'Australian dollar (A$)', locale: 'en-AU', pdfPrefix: 'A$' },
  { code: 'CAD', label: 'Canadian dollar (C$)', locale: 'en-CA', pdfPrefix: 'C$' },
  { code: 'SGD', label: 'Singapore dollar (S$)', locale: 'en-SG', pdfPrefix: 'S$' },
  { code: 'AED', label: 'UAE dirham (AED)', locale: 'en-AE', pdfPrefix: 'AED ' },
  { code: 'NPR', label: 'Nepalese rupee (Rs)', locale: 'en-IN', pdfPrefix: 'NPR ' },
  { code: 'LKR', label: 'Sri Lankan rupee (Rs)', locale: 'en-IN', pdfPrefix: 'LKR ' },
] as const

export type CurrencyCode = typeof CURRENCIES[number]['code']

function currencyOf(code: string) {
  return CURRENCIES.find(c => c.code === code) ?? CURRENCIES[0]
}

/** Whole-unit amount with the currency symbol, sign dropped: "₹12,500", "$1,200". */
export function formatMoney(n: number, currency: string = 'INR') {
  const c = currencyOf(currency)
  return new Intl.NumberFormat(c.locale, { style: 'currency', currency: c.code, maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(Math.abs(n))
}

/** The bare symbol, for input prefixes: "₹", "$". */
export function currencySymbol(currency: string = 'INR') {
  const c = currencyOf(currency)
  return new Intl.NumberFormat(c.locale, { style: 'currency', currency: c.code, maximumFractionDigits: 0 }).formatToParts(0).find(p => p.type === 'currency')?.value ?? c.code
}

/** PDF fonts can't draw every symbol (₹ included), so reports use a plain-text prefix. */
export function formatMoneyPdf(n: number, currency: string = 'INR') {
  const c = currencyOf(currency)
  return `${c.pdfPrefix}${Math.abs(n).toLocaleString(c.locale, { maximumFractionDigits: 0 })}`
}

// Reading saved settings ----------------------------------------------------------------

const num = (v: unknown, fallback: number, min: number, max: number) => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}
const str = (v: unknown, fallback: string, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : fallback)

/** Reads whatever is saved (possibly nothing, possibly from an older version) into a complete, valid settings object. */
export function normaliseFinanceSettings(raw: unknown): FinanceSettings {
  const d = DEFAULT_FINANCE_SETTINGS
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>

  const seen = new Set<string>()
  const categories: FinanceCategory[] = []
  if (Array.isArray(r.categories) && r.categories.length > 0) {
    for (const item of r.categories) {
      if (!item || typeof item !== 'object') continue
      const c = item as Record<string, unknown>
      const direction: MoneyDirection | null = c.direction === 'in' || c.direction === 'out' ? c.direction : null
      const key = typeof c.key === 'string' ? c.key.trim().slice(0, 60) : ''
      if (!direction || !key || PAYOUT_KEYS.has(key) || seen.has(`${direction}:${key}`)) continue
      seen.add(`${direction}:${key}`)
      categories.push({ key, label: str(c.label, key, 40), direction, ...(c.hidden === true && !LOCKED_KEYS.has(key) ? { hidden: true } : {}) })
    }
  }
  if (categories.length === 0) categories.push(...d.categories)
  // Built-ins with behaviour attached are always present.
  for (const c of d.categories.filter(isLockedCategory)) {
    if (!categories.some(x => x.key === c.key && x.direction === c.direction)) categories.push(c)
  }

  const currency = CURRENCIES.some(c => c.code === r.currency) ? (r.currency as CurrencyCode) : d.currency

  const numberMap = (v: unknown, fallback: number, max: number, keep: (n: number) => boolean) => {
    const out: Record<string, number> = {}
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [id, x] of Object.entries(v as Record<string, unknown>)) {
        const n = num(x, fallback, 0, max)
        if (keep(n)) out[id] = n
      }
    }
    return out
  }
  const shares = numberMap(r.shares, 1, 100, n => n !== 1)
  const percents = numberMap(r.percents, 0, 100, n => n > 0)
  const fixedAmounts = numberMap(r.fixedAmounts, 0, 1e9, n => n > 0)
  // Older saves called ratios "shares".
  const shareMode: ShareMode = r.shareMode === 'shares' ? 'ratio'
    : r.shareMode === 'percent' || r.shareMode === 'ratio' || r.shareMode === 'fixed' ? r.shareMode : 'equal'

  const cuts: OffTopCut[] = []
  let cutTotal = 0
  if (Array.isArray(r.cuts)) {
    for (const item of r.cuts) {
      if (!item || typeof item !== 'object') continue
      const c = item as Record<string, unknown>
      const percent = num(c.percent, 0, 0, 100)
      if (typeof c.memberId !== 'string' || !c.memberId || percent <= 0 || cutTotal + percent > 100) continue
      cutTotal += percent
      cuts.push({ id: str(c.id, `cut-${cuts.length}`, 40), label: str(c.label, 'Cut', 40), memberId: c.memberId, percent })
    }
  }

  const tags = Array.isArray(r.tags)
    ? [...new Set(r.tags.filter((t): t is string => typeof t === 'string').map(t => t.trim().slice(0, 40)).filter(Boolean))]
    : []

  const f = (r.features && typeof r.features === 'object' ? r.features : {}) as Record<string, unknown>
  const flag = (k: keyof FinanceFeatures) => (typeof f[k] === 'boolean' ? (f[k] as boolean) : d.features[k])

  return {
    fundName: str(r.fundName, d.fundName, 40),
    currency,
    categories,
    fundPercent: num(r.fundPercent, d.fundPercent, 0, 100),
    shareMode,
    shares,
    percents,
    fixedAmounts,
    cuts,
    tags,
    features: { projects: flag('projects'), recurring: flag('recurring'), receivables: flag('receivables'), tds: flag('tds'), approvals: flag('approvals'), accounts: flag('accounts') },
  }
}

/** The categories offered when adding a new entry in one direction. */
export function activeCategories(s: FinanceSettings, direction: MoneyDirection) {
  return s.categories.filter(c => c.direction === direction && !c.hidden)
}

/** A display name for whatever key is saved on an entry, including old or deleted ones. */
export function categoryLabel(s: FinanceSettings, key: string | null | undefined, direction?: MoneyDirection) {
  if (!key) return 'Uncategorised'
  if (key === SPLIT_KEY) return 'Split payout'
  if (key === BALANCE_TOP_UP_KEY) return 'Balance top-up'
  if (key === TRANSFER_KEY) return 'Moved money'
  if (key === CORRECTION_KEY) return 'Balance correction'
  const match = s.categories.find(c => c.key === key && (!direction || c.direction === direction)) ?? s.categories.find(c => c.key === key)
  if (match) return match.label
  return key.replace(/^c_/, '').replace(/[_-]+/g, ' ').replace(/^\w/, ch => ch.toUpperCase())
}

/** A stable key for a newly added category, unique within its direction. */
export function newCategoryKey(label: string, existing: FinanceCategory[]) {
  const base = 'c_' + (label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || 'category')
  let key = base
  for (let i = 2; existing.some(c => c.key === key); i++) key = `${base}_${i}`
  return key
}

/**
 * The workspace's sharing rules in the form the split maths takes, limited to current members (a
 * cut or amount for someone who has left is ignored).
 */
export function splitRulesFrom(s: FinanceSettings, memberIds: string[]) {
  const pick = (map: Record<string, number>, fallback: number) => Object.fromEntries(memberIds.map(id => [id, map[id] ?? fallback]))
  return {
    weights: s.shareMode === 'ratio' ? pick(s.shares, 1) : s.shareMode === 'percent' ? pick(s.percents, 0) : undefined,
    fixed: s.shareMode === 'fixed' ? pick(s.fixedAmounts, 0) : undefined,
    cuts: s.cuts.filter(c => memberIds.includes(c.memberId)),
  }
}

/** Sum of the percentages set for these members, for checking it reaches 100. */
export function percentTotal(s: FinanceSettings, memberIds: string[]) {
  return Math.round(memberIds.reduce((sum, id) => sum + (s.percents[id] ?? 0), 0) * 100) / 100
}

/** Percentages that add up to exactly 100, as even as whole numbers allow. */
export function evenPercents(memberIds: string[]): Record<string, number> {
  const base = memberIds.length > 0 ? Math.floor(100 / memberIds.length) : 0
  const extra = 100 - base * memberIds.length
  return Object.fromEntries(memberIds.map((id, i) => [id, base + (i < extra ? 1 : 0)]))
}

/** One plain sentence describing how a show's money is shared, for split screens and reports. */
export function describeSplitRule(s: FinanceSettings, fundPercent: number, nameOf: (id: string) => string) {
  const parts: string[] = []
  for (const c of s.cuts) parts.push(`${c.percent}% to ${nameOf(c.memberId)} (${c.label}) first`)
  if (s.shareMode === 'fixed') {
    parts.push(`a fixed amount to each person who played, and whatever is left to the ${s.fundName}`)
    return parts.join(', then ')
  }
  parts.push(`${fundPercent}% to the ${s.fundName}`)
  parts.push(
    s.shareMode === 'percent' ? 'the rest by each person’s percentage among everyone who played'
      : s.shareMode === 'ratio' ? 'the rest by ratio among everyone who played'
        : 'the rest equally among everyone who played'
  )
  return parts.join(', then ')
}
