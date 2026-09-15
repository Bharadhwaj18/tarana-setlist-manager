'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { markNotificationRead, markAllNotificationsRead } from '@/actions/notifications'
import { Button } from '@/components/ui/Button'
import type { NotificationItem } from '@/types/notifications'

interface Props {
  items: NotificationItem[]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })
}

export function NotificationInboxList({ items }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const hasUnread = items.some(n => !n.read)

  const handleClick = (n: NotificationItem) => {
    if (!n.read) startTransition(() => { markNotificationRead(n.id) })
    if (n.link) router.push(n.link)
  }

  return (
    <div>
      {hasUnread && (
        <div className="mb-3 flex justify-end">
          <Button variant="secondary" size="sm" onClick={() => startTransition(() => { markAllNotificationsRead() })}>
            Mark all read
          </Button>
        </div>
      )}
      <div className="space-y-2">
        {items.map(n => (
          <button
            key={n.id}
            onClick={() => handleClick(n)}
            className={cn(
              'flex w-full flex-col gap-1 rounded-xl border p-4 text-left shadow-sm transition-colors',
              n.read ? 'border-brand-200 bg-white hover:border-brand-400' : 'border-brand-400 bg-brand-50 hover:bg-brand-100'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-gray-900">{n.title}</p>
              {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
            </div>
            {n.body && <p className="text-sm text-gray-600">{n.body}</p>}
            <p className="text-xs text-gray-400">
              {n.senderName ? `${n.senderName} · ` : ''}{formatDate(n.createdAt)}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}
