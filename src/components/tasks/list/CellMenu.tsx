'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MenuOption<T extends string> {
  value: T
  label: ReactNode
  /** Plain text for screen readers when the label is a styled pill. */
  text?: string
}

interface Props<T extends string> {
  /** What sits in the cell; pressing it opens the menu. */
  trigger: ReactNode
  label: string
  options: MenuOption<T>[]
  value: T | T[] | null
  /** Pick several (people); otherwise picking closes the menu. */
  multiple?: boolean
  onChange: (value: T) => void
  footer?: ReactNode
  className?: string
  disabled?: boolean
}

/**
 * A cell's dropdown. The list is drawn on top of the page (not inside the table), so a table that
 * scrolls sideways never cuts it off; it closes on Escape, a tap outside, or after a pick.
 */
export function CellMenu<T extends string>({ trigger, label, options, value, multiple, onChange, footer, className, disabled }: Props<T>) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const selected = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v)

  useLayoutEffect(() => {
    if (!open || !btn.current) return
    const r = btn.current.getBoundingClientRect()
    const up = r.bottom + 280 > window.innerHeight && r.top > 280
    const left = Math.min(r.left, window.innerWidth - 232)
    setPos({ top: up ? r.top - 6 : r.bottom + 6, left: Math.max(8, left), up })
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (menu.current?.contains(e.target as Node) || btn.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus() } }
    const scroll = () => setOpen(false)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', key)
    window.addEventListener('resize', scroll)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', key); window.removeEventListener('resize', scroll) }
  }, [open])

  return (
    <>
      <button ref={btn} type="button" disabled={disabled} aria-label={label} aria-haspopup="listbox" aria-expanded={open}
        onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        className={cn('inline-flex min-h-8 max-w-full items-center rounded-lg text-left disabled:cursor-default', !disabled && 'hover:bg-brand-50', className)}>
        {trigger}
      </button>
      {open && pos && createPortal(
        <div ref={menu} role="listbox" aria-label={label} aria-multiselectable={multiple || undefined}
          style={{ position: 'fixed', left: pos.left, top: pos.up ? undefined : pos.top, bottom: pos.up ? window.innerHeight - pos.top : undefined }}
          className="z-[120] max-h-72 w-56 overflow-y-auto rounded-2xl border border-brand-200 bg-white p-1.5 shadow-xl">
          {options.map(o => (
            <button key={o.value} type="button" role="option" aria-selected={selected(o.value)}
              onClick={() => { onChange(o.value); if (!multiple) setOpen(false) }}
              className={cn('flex min-h-10 w-full items-center justify-between gap-2 rounded-xl px-2.5 text-left text-sm font-semibold text-gray-800 hover:bg-brand-50', selected(o.value) && 'bg-brand-100')}>
              <span className="min-w-0 truncate">{o.label}</span>
              {selected(o.value) && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
            </button>
          ))}
          {footer && <div className="mt-1 border-t border-brand-100 pt-1">{footer}</div>}
        </div>,
        document.body,
      )}
    </>
  )
}
