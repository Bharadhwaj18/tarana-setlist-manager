import { APP_NAME } from '@/lib/brand'
import { cn } from '@/lib/utils'

/**
 * The product name as a wordmark: custom lowercase "rigly" drawn as rounded monoline letters, with a
 * spotlight dot on the i. It sizes with the text around it (set the size with a text-* class) and takes
 * its colour from the text colour. `tone` picks the dot: "sidebar" for the dark sidebar, "page" for
 * ordinary page backgrounds.
 */
export function Wordmark({ tone = 'page', className }: { tone?: 'sidebar' | 'page'; className?: string }) {
  return (
    <svg role="img" aria-label={APP_NAME} viewBox="0 3 94 56" className={cn('inline-block h-[1.35em] w-auto align-[-0.458em]', className)}>
      <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 20 V40 M5 30 C5 23 9 20 15 20" />
        <path d="M25 20 V40" />
        <circle cx="43" cy="30" r="9.5" />
        <path d="M52.5 20 V46 C52.5 51.5 48 54.5 42 54.5 C38 54.5 34.5 53 32.5 50" />
        <path d="M66 6 V40" />
        <path d="M74 20 L82 40 M90 20 L78 53" />
      </g>
      <circle cx="25" cy="9" r="3.6" className={tone === 'sidebar' ? 'fill-sidebar-accent' : 'fill-brand-600'} />
    </svg>
  )
}
