import type { ReferenceSource } from '@/lib/song-references'

/** A small mark in each service's own colour, so a reference reads at a glance. */
export function ServiceMark({ source, size = 16, className }: { source: ReferenceSource; size?: number; className?: string }) {
  const common = { 'aria-hidden': true, width: size, height: size, viewBox: '0 0 24 24', className: className ?? 'shrink-0' } as const
  if (source === 'spotify') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="11" fill="#1DB954" />
        <path d="M6.5 9.2c3.8-1.1 8-.8 11.2 1M7.2 12.4c3-.8 6.4-.5 9 1M7.9 15.4c2.4-.6 4.9-.4 6.9.8" stroke="#0B0B0C" strokeWidth="1.7" fill="none" strokeLinecap="round" />
      </svg>
    )
  }
  if (source === 'youtube') {
    return (
      <svg {...common}>
        <rect x="1.5" y="4.5" width="21" height="15" rx="4.5" fill="#FF0033" />
        <path d="M10 8.8v6.4l5.6-3.2z" fill="#fff" />
      </svg>
    )
  }
  if (source === 'apple') {
    return (
      <svg {...common}>
        <rect x="1.5" y="1.5" width="21" height="21" rx="6" fill="#FA243C" />
        <path d="M10 16.5V8l7-1.5v8" stroke="#fff" strokeWidth="1.8" fill="none" />
        <circle cx="8.6" cy="16.6" r="1.8" fill="#fff" />
        <circle cx="15.6" cy="14.8" r="1.8" fill="#fff" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <rect x="1.5" y="1.5" width="21" height="21" rx="6" fill="#FF5500" />
      <path d="M6 15.5h11a2.6 2.6 0 0 0 0-5.2 4 4 0 0 0-7.6-1" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  )
}
