import { cn } from '@/lib/utils'

const parse = (dateStr: string) => new Date(dateStr + 'T00:00:00Z')

/**
 * Calendar-style tile: weekday, day number and (for the large size) month.
 * `strong` is the filled forest tile for the next or selected item; `soft` is the quiet default.
 */
export function DateTile({ date, tone = 'soft', size = 'md' }: { date: string; tone?: 'strong' | 'soft'; size?: 'sm' | 'md' | 'lg' }) {
  const d = parse(date)
  const weekday = new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'UTC' }).format(d).toUpperCase()
  const month = new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: 'UTC' }).format(d).toUpperCase()
  const day = d.getUTCDate()

  return (
    <div
      className={cn(
        'shrink-0 rounded-xl text-center',
        tone === 'strong' ? 'bg-hero text-hero-fg' : 'bg-brand-100 text-gray-800',
        size === 'sm' && 'w-10 py-1',
        size === 'md' && 'w-[52px] py-1.5',
        size === 'lg' && 'w-16 py-2'
      )}
    >
      <div className={cn('font-bold tracking-[0.14em]', size === 'sm' ? 'text-[9px]' : 'text-[10px]', tone === 'strong' ? 'text-sidebar-accent' : 'text-gray-500')}>
        {size === 'sm' ? month : weekday}
      </div>
      <div className={cn('font-display font-bold leading-[1.1]', size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-[22px]' : 'text-[17px]')}>{day}</div>
      {size === 'lg' && <div className="text-[10px] font-bold tracking-[0.14em]">{month}</div>}
    </div>
  )
}
