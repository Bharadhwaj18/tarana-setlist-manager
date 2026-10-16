'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, CalendarDays, CalendarX, CheckSquare, ListMusic, Users, Wallet, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { markNotificationRead, markAllNotificationsRead, openNotification } from '@/actions/notifications'
import { useToast } from '@/components/ui/Toaster'
import type { NotificationItem } from '@/types/notifications'

interface Props {
  /** "sidebar" sits on the dark sidebar; "page" sits on the normal page background (phone header). */
  tone?: 'sidebar' | 'page'
  notifications: NotificationItem[]
}

function iconFor(type: string): LucideIcon {
  if (type.startsWith('show_')) return CalendarDays
  if (type.startsWith('task_')) return CheckSquare
  if (type.startsWith('payment_') || type.startsWith('transaction_')) return Wallet
  if (type.startsWith('setlist_')) return ListMusic
  if (type.startsWith('unavailability_')) return CalendarX
  if (type.startsWith('workspace_')) return Users
  return Bell
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function NotificationBell({ notifications, tone = 'sidebar' }: Props) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [, startTransition] = useTransition()
  const router = useRouter()
  const unreadCount = notifications.filter(n => !n.read).length
  const recent = notifications.slice(0, 12)
  const fresh = recent.filter(n => !n.read)
  const earlier = recent.filter(n => n.read)

  const DROPDOWN_WIDTH = 352 // matches w-[22rem]
  const VIEWPORT_MARGIN = 8

  // Opens to the right of the bell, portaled to <body> so it's never
  // clipped/misplaced by a narrow ancestor (the desktop sidebar is only
  // ~14rem wide). Clamped so it still fits on screen if the bell sits near
  // the right edge (mobile top bar, or a narrow window).
  const reposition = () => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const maxLeft = window.innerWidth - DROPDOWN_WIDTH - VIEWPORT_MARGIN
    setPosition({ top: rect.bottom + 8, left: Math.max(VIEWPORT_MARGIN, Math.min(rect.left, maxLeft)) })
  }

  useEffect(() => {
    if (!open) return
    const onResize = () => reposition()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [open])

  const handleToggle = () => {
    if (!open) {
      reposition()
      // Seeing the dropdown IS reading it — no separate "mark all read"
      // action needed, matches how every other notification tray behaves.
      if (unreadCount > 0) startTransition(() => { markAllNotificationsRead() })
    }
    setOpen(v => !v)
  }

  const toast = useToast()
  const handleClick = (n: NotificationItem) => {
    setOpen(false)
    if (!n.read) startTransition(() => { markNotificationRead(n.id) })
    if (n.link) startTransition(async () => { const res = await openNotification(n.id); if (res.error) { toast(res.error, 'error'); return }; router.push(res.link ?? '/') })
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleToggle}
        aria-label="Notifications"
        className={cn('relative rounded-full p-2', tone === 'page' ? 'text-gray-700 hover:bg-brand-100' : 'rounded-md p-1.5 text-sidebar-fg hover:bg-sidebar-hover')}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span key={unreadCount} data-tip={`${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`} className="animate-badge-bounce absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && position && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 w-[22rem] max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-2xl"
            style={{ top: position.top, left: position.left }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-brand-100 px-4 py-3">
              <span className="font-display text-lg font-bold text-gray-900">Notifications</span>
              <div className="flex items-center gap-3 text-xs font-bold">
                {unreadCount > 0 && (
                  <button type="button" onClick={() => startTransition(() => { markAllNotificationsRead() })} className="text-gray-500 hover:text-gray-900">
                    Mark all read
                  </button>
                )}
                <Link href="/notifications" onClick={() => setOpen(false)} className="text-brand-600 hover:underline">
                  See all
                </Link>
              </div>
            </div>
            {recent.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <Bell className="h-8 w-8 text-brand-300" />
                <p className="text-sm font-semibold text-gray-700">You&apos;re all caught up</p>
                <p className="text-xs text-gray-500">New shows, tasks and payments show up here.</p>
              </div>
            ) : (
              <div className="no-scrollbar max-h-[min(26rem,70vh)] overflow-y-auto">
                {([['New', fresh], ['Earlier', earlier]] as const).map(([label, items]) => items.length > 0 && (
                  <section key={label}>
                    <h3 className="sticky top-0 bg-white/95 px-4 pb-1 pt-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-gray-400 backdrop-blur">{label}</h3>
                    {items.map(n => {
                      const Icon = iconFor(n.type)
                      return (
                        <button
                          key={n.id}
                          onClick={() => handleClick(n)}
                          className={cn('flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-brand-50', !n.read && 'bg-brand-50/70')}
                        >
                          <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', n.read ? 'bg-brand-100 text-gray-500' : 'bg-brand-400 text-white')}>
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={cn('block text-sm leading-snug', n.read ? 'font-medium text-gray-700' : 'font-bold text-gray-900')}>{n.title}</span>
                            {n.body && <span className="mt-0.5 line-clamp-2 block text-xs text-gray-500">{n.body}</span>}
                            <span className="mt-1 block text-[11px] text-gray-400">{n.senderName ? `${n.senderName} · ` : ''}{timeAgo(n.createdAt)}</span>
                          </span>
                          {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-label="Unread" />}
                        </button>
                      )
                    })}
                  </section>
                ))}
              </div>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  )
}
