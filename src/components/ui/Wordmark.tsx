import { APP_NAME_PARTS } from '@/lib/brand'
import { cn } from '@/lib/utils'

/**
 * The product name as a wordmark. `tone` picks the accent for the second half: "sidebar" for the
 * dark sidebar, "page" for ordinary page backgrounds. Text colour and size come from className.
 */
export function Wordmark({ tone = 'page', className }: { tone?: 'sidebar' | 'page'; className?: string }) {
  const [first, second] = APP_NAME_PARTS
  return (
    <span className={cn('font-display font-semibold tracking-tight', className)}>
      {first}
      <span className={cn('font-bold', tone === 'sidebar' ? 'text-sidebar-accent' : 'text-brand-600')}>{second}</span>
    </span>
  )
}
