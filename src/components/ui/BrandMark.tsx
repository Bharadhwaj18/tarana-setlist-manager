import { cn } from '@/lib/utils'

/**
 * The "Signal" mark: an A whose crossbar is a sound wave. The A takes the surrounding text
 * colour; the wave uses the accent colour (sage on light surfaces, a brighter green in dark mode).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M12 54 L32 10 L52 54" stroke="currentColor" strokeWidth="5" />
      <path d="M19 40 q3.35 -9 6.7 0 t6.7 0 t6.7 0 t6.7 0" className="stroke-sidebar-accent" strokeWidth="4" />
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
