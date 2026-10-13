import { cn } from '@/lib/utils'
import { WORKSPACE_TONES, normaliseTone, workspaceInitial } from '@/lib/workspace-tones'

const SIZES = { xs: 24, sm: 32, md: 40, lg: 56, xl: 72 } as const
export type WorkspaceAvatarSize = keyof typeof SIZES | number

interface WorkspaceAvatarProps {
  name: string
  /** Stored tone name; anything unknown renders as forest. */
  color?: string | null
  /** Public URL of the uploaded logo or photo. When present it replaces the initial. */
  avatarUrl?: string | null
  size?: WorkspaceAvatarSize
  className?: string
}

/** A workspace's logo or photo, or a coloured tile with its initial when it has none. Decorative: the name is always next to it. */
export function WorkspaceAvatar({ name, color, avatarUrl, size = 'md', className }: WorkspaceAvatarProps) {
  const px = typeof size === 'number' ? size : SIZES[size]
  const style = { width: px, height: px, borderRadius: Math.round(px * 0.28) }

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatarUrl} alt="" aria-hidden="true" style={style} className={cn('shrink-0 object-cover', className)} />
    )
  }

  return (
    <span
      aria-hidden="true"
      style={{ ...style, fontSize: Math.round(px * 0.44) }}
      className={cn('flex shrink-0 select-none items-center justify-center font-display font-bold leading-none', WORKSPACE_TONES[normaliseTone(color)].tile, className)}
    >
      {workspaceInitial(name)}
    </span>
  )
}
