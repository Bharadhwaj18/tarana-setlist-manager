'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { markNotificationRead, markAllNotificationsRead } from '@/actions/notifications'
import type { NotificationItem } from '@/types/notifications'

interface Props {
  notifications: NotificationItem[]
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

export function NotificationBell({ notifications }: Props) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [, startTransition] = useTransition()
  const router = useRouter()
  const unreadCount = notifications.filter(n => !n.read).length
  const recent = notifications.slice(0, 8)

  const DROPDOWN_WIDTH = 320 // matches w-80
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

  const handleClick = (n: NotificationItem) => {
    setOpen(false)
    if (!n.read) startTransition(() => { markNotificationRead(n.id) })
    if (n.link) router.push(n.link)
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleToggle}
        aria-label="Notifications"
        className="relative rounded-md p-1.5 text-gray-600 hover:bg-brand-100"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && position && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 w-80 max-w-[90vw] rounded-xl border border-brand-200 bg-white shadow-lg"
            style={{ top: position.top, left: position.left }}
          >
            <div className="flex items-center justify-between border-b border-brand-100 px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Notifications</span>
              <Link href="/notifications" onClick={() => setOpen(false)} className="text-xs font-medium text-brand-600 hover:underline">
                See all
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">Nothing yet</p>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                {recent.map(n => (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={cn(
                      'block w-full border-b border-brand-50 px-4 py-3 text-left last:border-0 hover:bg-brand-50',
                      !n.read && 'bg-brand-50/60'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900">{n.title}</p>
                      {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                    </div>
                    {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{n.body}</p>}
                    <p className="mt-1 text-[11px] text-gray-400">
                      {n.senderName ? `${n.senderName} · ` : ''}{timeAgo(n.createdAt)}
                    </p>
                  </button>
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
