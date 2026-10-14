'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MenuItem {
  label: string
  href?: string
  onSelect?: () => void
  icon?: LucideIcon
  danger?: boolean
}

interface Props {
  items: MenuItem[]
  /** Shown at the top of the menu, usually the item's name. */
  title?: string
  className?: string
  children: ReactNode
}

const HOLD_MS = 480
const MOVE_TOLERANCE = 10

/**
 * Wraps a list item so that pressing and holding it (phone) or right-clicking it (desktop) opens
 * a menu of actions for that item. The normal tap still works: a long press never also "clicks".
 */
export function LongPressMenu({ items, title, className, children }: Props) {
  const router = useRouter()
  const [anchor, setAnchor] = useState<{ x: number; y: number; sheet: boolean } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)
  const lastOpen = useRef(0)

  const clear = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  const openAt = useCallback((x: number, y: number) => {
    lastOpen.current = Date.now()
    setAnchor({ x, y, sheet: window.matchMedia('(max-width: 767px)').matches })
  }, [])

  const close = useCallback(() => setAnchor(null), [])

  useEffect(() => {
    if (!anchor) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [anchor, close])

  const select = (item: MenuItem) => {
    close()
    if (item.href) router.push(item.href)
    else item.onSelect?.()
  }

  return (
    <div
      className={cn('[-webkit-touch-callout:none] [@media(pointer:coarse)]:select-none', className)}
      onTouchStart={e => {
        if (e.touches.length !== 1) return clear()
        fired.current = false
        const t = e.touches[0]
        start.current = { x: t.clientX, y: t.clientY }
        clear()
        timer.current = setTimeout(() => {
          fired.current = true
          navigator.vibrate?.(12)
          openAt(start.current?.x ?? 0, start.current?.y ?? 0)
        }, HOLD_MS)
      }}
      onTouchMove={e => {
        const t = e.touches[0]
        if (start.current && Math.hypot(t.clientX - start.current.x, t.clientY - start.current.y) > MOVE_TOLERANCE) clear()
      }}
      onTouchEnd={clear}
      onTouchCancel={clear}
      onClickCapture={e => {
        if (fired.current) {
          e.preventDefault()
          e.stopPropagation()
          fired.current = false
        }
      }}
      onContextMenu={e => {
        e.preventDefault()
        if (Date.now() - lastOpen.current < 800) return
        openAt(e.clientX, e.clientY)
      }}
    >
      {children}

      {anchor && createPortal(
        <div className="fixed inset-0 z-[70]" onClick={close} onContextMenu={e => { e.preventDefault(); close() }}>
          <div className={cn('absolute inset-0', anchor.sheet && 'bg-black/40')} />
          <div
            role="menu"
            onClick={e => e.stopPropagation()}
            className={cn(
              'absolute overflow-hidden bg-white shadow-2xl',
              anchor.sheet
                ? 'inset-x-0 bottom-0 rounded-t-3xl border-t border-brand-200 pb-[max(1rem,env(safe-area-inset-bottom))]'
                : 'w-56 rounded-2xl border border-brand-200 py-1.5'
            )}
            style={anchor.sheet ? undefined : { left: Math.max(8, Math.min(anchor.x, window.innerWidth - 232)), top: Math.max(8, Math.min(anchor.y, window.innerHeight - items.length * 44 - 24)) }}
          >
            {anchor.sheet && (
              <div className="px-5 pb-1 pt-3">
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-brand-200" />
                {title && <p className="truncate font-display text-lg font-bold text-gray-900">{title}</p>}
              </div>
            )}
            {items.map(item => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => select(item)}
                className={cn(
                  'flex w-full items-center gap-3 text-left font-semibold hover:bg-brand-50',
                  anchor.sheet ? 'px-5 py-3.5 text-base' : 'px-4 py-2.5 text-sm',
                  item.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-800'
                )}
              >
                {item.icon && <item.icon className={cn('shrink-0', anchor.sheet ? 'h-5 w-5' : 'h-4 w-4', item.danger ? 'text-red-500' : 'text-gray-400')} />}
                {item.label}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
