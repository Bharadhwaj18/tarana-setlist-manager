'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * One small tooltip for the whole app. Hover (or keyboard focus, or a touch held briefly) over an icon-only
 * control and it names the control: its aria-label, or its title. Anything can also name itself with
 * data-tip="...". Controls with visible text don't get one, since the text already says what they do.
 */

const DELAY_MOUSE = 350
const SHOW_TOUCH = 1500
const CONTROL = 'button, a, [role="button"], [role="tab"], [role="option"], [role="menuitem"], [role="checkbox"], [role="radio"], [role="switch"], input, select, textarea, [data-tip]'

function labelFor(el: Element): string | null {
  const tip = el.closest<HTMLElement>('[data-tip]')
  if (tip?.dataset.tip) return tip.dataset.tip
  const control = el.closest<HTMLElement>(CONTROL)
  if (!control) return null
  // Only icon-only controls: visible text already says what it does.
  const text = control.textContent?.trim() ?? ''
  const label = control.getAttribute('aria-label')?.trim() || control.getAttribute('title')?.trim() || ''
  if (!label) return null
  if (text && text !== label) return null
  return label
}

export function TooltipLayer() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number; up: boolean } | null>(null)
  const anchor = useRef<HTMLElement | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const bubble = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // Take the browser's own slow title tooltip out of the way while ours is showing.
    const hide = () => {
      clearTimeout(timer.current)
      const el = anchor.current
      if (el && el.dataset.tipTitle !== undefined) { el.setAttribute('title', el.dataset.tipTitle); delete el.dataset.tipTitle }
      anchor.current = null
      setTip(null)
    }
    const show = (el: HTMLElement, delay: number, hold?: number) => {
      clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        const text = labelFor(el)
        if (!text) return
        if (el.hasAttribute('title')) { el.dataset.tipTitle = el.getAttribute('title') ?? ''; el.removeAttribute('title') }
        anchor.current = el
        const r = el.getBoundingClientRect()
        const up = r.top > 48
        setTip({ text, x: r.left + r.width / 2, y: up ? r.top - 8 : r.bottom + 8, up })
        if (hold) timer.current = setTimeout(hide, hold)
      }, delay)
    }
    const target = (e: Event) => (e.target instanceof Element ? e.target : null)

    const over = (e: PointerEvent) => {
      const el = target(e)?.closest<HTMLElement>(CONTROL) ?? target(e)?.closest<HTMLElement>('[data-tip]')
      if (!el || el === anchor.current) return
      if (e.pointerType === 'touch') return // touch uses the press below
      hide()
      show(el, DELAY_MOUSE)
    }
    const out = (e: PointerEvent) => { if (e.pointerType !== 'touch') hide() }
    const press = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return
      const el = target(e)?.closest<HTMLElement>(CONTROL) ?? target(e)?.closest<HTMLElement>('[data-tip]')
      hide()
      if (el) show(el, 450, SHOW_TOUCH)
    }
    const focus = (e: FocusEvent) => {
      const el = target(e)?.closest<HTMLElement>(CONTROL)
      if (el && el.matches(':focus-visible')) show(el, 150)
    }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') hide() }

    document.addEventListener('pointerover', over)
    document.addEventListener('pointerout', out)
    document.addEventListener('pointerdown', press)
    document.addEventListener('focusin', focus)
    document.addEventListener('focusout', hide)
    document.addEventListener('pointerdown', hide, true)
    document.addEventListener('keydown', key)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => {
      hide()
      document.removeEventListener('pointerover', over)
      document.removeEventListener('pointerout', out)
      document.removeEventListener('pointerdown', press)
      document.removeEventListener('focusin', focus)
      document.removeEventListener('focusout', hide)
      document.removeEventListener('pointerdown', hide, true)
      document.removeEventListener('keydown', key)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [])

  // Keep the bubble on screen: centred on the control, pulled in from the edges.
  useLayoutEffect(() => {
    const b = bubble.current
    if (!b || !tip) return
    const w = b.offsetWidth
    const left = Math.max(8, Math.min(tip.x - w / 2, window.innerWidth - w - 8))
    b.style.left = `${left}px`
    b.style.top = `${tip.up ? tip.y - b.offsetHeight : tip.y}px`
  }, [tip])

  if (!tip) return null
  return createPortal(
    <div ref={bubble} role="tooltip" className="pointer-events-none fixed z-[200] max-w-[16rem] rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-semibold leading-snug text-white shadow-lg animate-fade-in" style={{ left: 0, top: 0 }}>
      {tip.text}
    </div>,
    document.body,
  )
}
