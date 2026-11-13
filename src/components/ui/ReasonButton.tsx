'use client'

import type { ComponentProps } from 'react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toaster'
import { cn } from '@/lib/utils'

/**
 * A button that can't be used yet still says why. Pass `blocked` with the reason ("Pick the show first") and the
 * button looks disabled, but tapping it shows the reason instead of silently doing nothing.
 */
export function ReasonButton({ blocked, onClick, className, ...props }: ComponentProps<typeof Button> & { blocked?: string | null | false }) {
  const toast = useToast()
  if (!blocked) return <Button className={className} onClick={onClick} {...props} />
  return (
    <Button
      {...props}
      type="button"
      aria-disabled="true"
      title={blocked}
      className={cn('cursor-not-allowed opacity-60 enabled:active:scale-100', className)}
      onClick={e => { e.preventDefault(); toast(blocked, 'info') }}
    />
  )
}
