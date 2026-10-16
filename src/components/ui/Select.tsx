'use client'

import { Children, isValidElement, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OptionProps { value?: string | number; children?: ReactNode; disabled?: boolean }
interface Option { value: string; label: string; disabled: boolean }

/** The event shape handlers already expect from a native select, so callers keep reading e.target.value. */
export interface SelectChange { target: { value: string; name?: string } }

interface Props {
  value: string | number
  onChange?: (e: SelectChange) => void
  /** <option value="...">Label</option> elements, as with a native select. */
  children: ReactNode
  id?: string
  name?: string
  className?: string
  disabled?: boolean
  required?: boolean
  title?: string
  'aria-label'?: string
}

function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children)
  return ''
}

function optionsFrom(children: ReactNode): Option[] {
  const out: Option[] = []
  Children.forEach(children, child => {
    if (!isValidElement(child)) return
    if (child.type === 'option') {
      const p = (child as ReactElement<OptionProps>).props
      const label = textOf(p.children)
      out.push({ value: String(p.value ?? label), label, disabled: !!p.disabled })
    } else {
      out.push(...optionsFrom((child as ReactElement<{ children?: ReactNode }>).props.children))
    }
  })
  return out
}

interface Place { top: number; left: number; width: number; up: boolean; absolute: boolean }

const MENU_MAX = 288 // max-h-72

/**
 * The app's dropdown, in place of the browser's own: the list is drawn in the app's style, in both themes,
 * on top of the page (or inside the open dialog), flips upward near the bottom of the screen, and works by
 * keyboard (arrows, Enter, Escape, typing a letter).
 */
export function Select({ value, onChange, children, id, name, className, disabled, title, 'aria-label': ariaLabel }: Props) {
  const options = optionsFrom(children)
  const current = String(value)
  const selected = options.find(o => o.value === current)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [place, setPlace] = useState<Place | null>(null)
  const [layer, setLayer] = useState<HTMLElement | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const listId = useId()

  // Place the list under the button, or above it when there isn't room. Inside a dialog it goes in the dialog,
  // so the dialog still treats taps on it as inside.
  const openList = () => {
    if (disabled || !button.current) return
    const r = button.current.getBoundingClientRect()
    const dialog = button.current.closest<HTMLElement>('[role="dialog"]')
    const up = r.bottom + MENU_MAX + 8 > window.innerHeight && r.top > window.innerHeight - r.bottom
    const width = Math.max(r.width, 180)
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8))
    if (dialog) {
      const d = dialog.getBoundingClientRect()
      setPlace({ top: (up ? r.top : r.bottom) - d.top + dialog.scrollTop - dialog.clientTop, left: left - d.left - dialog.clientLeft, width, up, absolute: true })
    } else {
      setPlace({ top: up ? r.top : r.bottom, left, width, up, absolute: false })
    }
    setLayer(dialog ?? document.body)
    setActive(Math.max(0, options.findIndex(o => o.value === current)))
    setOpen(true)
  }
  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) button.current?.focus()
  }
  const choose = (o: Option) => {
    if (o.disabled) return
    if (o.value !== current) onChange?.({ target: { value: o.value, name } })
    close()
  }

  useEffect(() => {
    if (!open) return
    list.current?.focus()
    const outside = (e: Event) => {
      if (list.current?.contains(e.target as Node) || button.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const resize = () => setOpen(false)
    document.addEventListener('pointerdown', outside)
    window.addEventListener('resize', resize)
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', resize) }
  }, [open])

  // Keep the highlighted option in view while moving with the keyboard.
  useEffect(() => {
    if (!open) return
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const move = (from: number, dir: 1 | -1) => {
    for (let i = from + dir; i >= 0 && i < options.length; i += dir) if (!options[i].disabled) return i
    return from
  }

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => move(a, 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => move(a, -1)) }
    else if (e.key === 'Home') { e.preventDefault(); setActive(move(-1, 1)) }
    else if (e.key === 'End') { e.preventDefault(); setActive(move(options.length, -1)) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const o = options[active]; if (o) choose(o) }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }
    else if (e.key === 'Tab') close(false)
    else if (e.key.length === 1) {
      const k = e.key.toLowerCase()
      const at = options.findIndex((o, i) => i > active && !o.disabled && o.label.toLowerCase().startsWith(k))
      const wrap = at >= 0 ? at : options.findIndex(o => !o.disabled && o.label.toLowerCase().startsWith(k))
      if (wrap >= 0) setActive(wrap)
    }
  }

  return (
    <>
      <button ref={button} id={id} type="button" disabled={disabled} title={title}
        aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined}
        onClick={() => (open ? close() : openList())}
        onKeyDown={e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); openList() } }}
        className={cn('inline-flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60', className)}>
        <span className={cn('min-w-0 truncate', !selected && 'text-gray-400')}>{selected?.label ?? options[0]?.label ?? ''}</span>
        <ChevronDown aria-hidden className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>
      {name && <input type="hidden" name={name} value={current} />}
      {open && place && layer && createPortal(
        <div ref={list} id={listId} role="listbox" tabIndex={-1} aria-label={ariaLabel} aria-activedescendant={`${listId}-${active}`} onKeyDown={onListKey}
          style={{
            position: place.absolute ? 'absolute' : 'fixed',
            left: place.left, width: place.width,
            ...(place.up ? { top: place.top - 6, transform: 'translateY(-100%)' } : { top: place.top + 6 }),
          }}
          className="animate-menu-in z-[130] max-h-72 overflow-y-auto rounded-2xl border border-brand-200 bg-white p-1.5 shadow-xl outline-none">
          {options.map((o, i) => {
            const isSelected = o.value === current
            return (
              <div key={`${o.value}-${i}`} id={`${listId}-${i}`} data-index={i} role="option" aria-selected={isSelected} aria-disabled={o.disabled || undefined}
                onPointerEnter={() => !o.disabled && setActive(i)} onClick={() => choose(o)}
                className={cn('flex min-h-10 cursor-pointer items-center justify-between gap-2 rounded-xl px-2.5 text-sm font-semibold text-gray-800',
                  i === active && 'bg-brand-50', isSelected && 'bg-brand-100 font-bold', o.disabled && 'cursor-default opacity-40')}>
                <span className="min-w-0 truncate">{o.label || ' '}</span>
                {isSelected && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
              </div>
            )
          })}
        </div>,
        layer,
      )}
    </>
  )
}
