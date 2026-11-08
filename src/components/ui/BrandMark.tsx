import { cn } from '@/lib/utils'

/**
 * The Rigly app mark: a bold lowercase "r" with a spotlight dot, the same dot that sits on the "i" in the
 * wordmark. The r takes the surrounding text colour; the dot uses the accent colour (sage on light surfaces,
 * a brighter green in dark mode).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M20 48 V24 M20 36 C20 27 26 23 34 23" stroke="currentColor" strokeWidth="9" />
      <circle cx="43" cy="17" r="5.2" className="fill-sidebar-accent" stroke="none" />
    </svg>
  )
}

/** The logo on its tile, shown wherever the product mark goes. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-hero text-hero-fg shadow-sm', className)}>
      <LogoMark className="h-[72%] w-[72%]" />
    </div>
  )
}
