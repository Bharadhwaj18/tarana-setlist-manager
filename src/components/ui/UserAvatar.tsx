import { cn } from '@/lib/utils'

// Muted tones for people without a photo, picked from their id so a person always gets the same one.
const TONES = ['#1F4E6B', '#5B2A5E', '#8A5A12', '#8E3A4A', '#1F5A43', '#1F2933']

function toneFor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return TONES[h % TONES.length]
}

interface Props {
  name: string
  /** Used to pick a stable colour when there's no photo. */
  id?: string
  avatarUrl?: string | null
  size?: number
  className?: string
}

/** A person's photo, or a round tile with their initial. Decorative: their name is always shown next to it. */
export function UserAvatar({ name, id, avatarUrl, size = 40, className }: Props) {
  const style = { width: size, height: size }
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatarUrl} alt="" aria-hidden="true" style={style} className={cn('shrink-0 rounded-full bg-gray-200 object-cover', className)} />
  }
  const initial = (name.trim()[0] ?? '?').toUpperCase()
  return (
    <span aria-hidden="true" style={{ ...style, background: toneFor(id ?? name), fontSize: Math.round(size * 0.42) }}
      className={cn('flex shrink-0 select-none items-center justify-center rounded-full font-display font-bold leading-none text-white', className)}>
      {initial}
    </span>
  )
}
