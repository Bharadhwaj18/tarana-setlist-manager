import { cn } from '@/lib/utils'

// Stand-in colours for songs without cover art, picked from the title so a song keeps its colour.
const SWATCHES = [
  ['#1B1B1B', '#B8231F'], ['#3B2414', '#D08A3A'], ['#0E2A3A', '#3E8DA8'], ['#2B1530', '#B0548E'],
  ['#2E2A12', '#C8B24A'], ['#14243B', '#5F86C9'], ['#10291F', '#3FA27A'], ['#2A1010', '#9E3A2E'],
]

function initials(title: string) {
  const words = title.replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean)
  return ((words[0]?.[0] ?? '?') + (words[1]?.[0] ?? '')).toUpperCase()
}

/** A song's cover: its artwork when it has one, otherwise a coloured tile with its initials. */
export function Cover({ url, title, size = 44, className }: { url?: string | null; title: string; size?: number; className?: string }) {
  const style = { width: size, height: size }
  const radius = size >= 64 ? 'rounded-2xl' : 'rounded-[10px]'
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" aria-hidden="true" loading="lazy" style={style} className={cn('shrink-0 bg-gray-200 object-cover', radius, className)} />
  }
  let hash = 0
  for (const ch of title) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  const [a, b] = SWATCHES[hash % SWATCHES.length]
  return (
    <span aria-hidden="true" style={{ ...style, background: `linear-gradient(135deg, ${a}, ${b})`, fontSize: Math.round(size * 0.3), padding: Math.round(size * 0.1) }}
      className={cn('inline-flex shrink-0 items-end justify-start font-display font-bold leading-none text-white/90', radius, className)}>
      {initials(title)}
    </span>
  )
}
