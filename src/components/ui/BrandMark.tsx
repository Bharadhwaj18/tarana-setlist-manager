import { Music2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Placeholder logo tile, shown wherever the product mark goes until a real logo exists. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-hero text-hero-fg shadow-sm', className)}>
      <Music2 className="h-[55%] w-[55%]" />
    </div>
  )
}
