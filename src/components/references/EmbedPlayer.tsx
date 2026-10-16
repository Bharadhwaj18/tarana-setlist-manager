'use client'

import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { loadSoundCloud, loadSpotify, loadYouTube } from '@/lib/embed-apis'
import { SOURCE_NAMES, type PlayableReference } from '@/lib/song-references'

export interface EmbedHandle {
  /** Jump to a time and play from there. */
  seek(seconds: number): void
  /** Where playback is now, in seconds (0 if unknown). */
  position(): number
}

interface Props {
  reference: Pick<PlayableReference, 'source' | 'externalId' | 'url' | 'title'>
  /** compact: a short bar for the mini player. */
  size?: 'full' | 'compact'
  /** Try to start playing once loaded. Phones may still need a tap on the player itself. */
  autoPlay?: boolean
  onEnded?: () => void
  className?: string
}

interface Driver { seek(s: number): void; position(): number }

/**
 * The service's own player (Spotify, YouTube or SoundCloud), driven through its player API so the app
 * can jump to moments and notice when a song ends. Apple Music has no player API; callers link out instead.
 */
export const EmbedPlayer = forwardRef<EmbedHandle, Props>(function EmbedPlayer({ reference, size = 'full', autoPlay = false, onEnded, className }, ref) {
  const host = useRef<HTMLDivElement>(null)
  const driver = useRef<Driver | null>(null)
  const ended = useRef(onEnded)
  const [failed, setFailed] = useState(false)
  const { source, externalId, url, title } = reference

  useLayoutEffect(() => { ended.current = onEnded })

  useImperativeHandle(ref, () => ({
    seek: s => driver.current?.seek(s),
    position: () => driver.current?.position() ?? 0,
  }), [])

  useEffect(() => {
    const el = host.current
    if (!el) return
    // The service replaces this node with its iframe, so it lives outside React's tree.
    const mount = document.createElement('div')
    mount.style.width = '100%'
    mount.style.height = '100%'
    el.appendChild(mount)
    let cancelled = false
    let teardown = () => {}
    const fail = () => { if (!cancelled) setFailed(true) }

    if (source === 'spotify' && externalId) {
      loadSpotify().then(api => {
        if (cancelled) return
        api.createController(mount, { uri: `spotify:track:${externalId}`, width: '100%', height: size === 'compact' ? 80 : 152 }, c => {
          if (cancelled) { c.destroy(); return }
          let pos = 0
          let done = false
          c.addListener('playback_update', e => {
            const { position, duration } = e.data
            pos = position / 1000
            const atEnd = duration > 0 && position >= duration - 800
            if (atEnd && !done) { done = true; ended.current?.() } else if (!atEnd) done = false
          })
          if (autoPlay) c.addListener('ready', () => c.play())
          driver.current = { seek: s => { c.seek(s); c.resume() }, position: () => pos }
          teardown = () => c.destroy()
        })
      }).catch(fail)
    } else if (source === 'youtube' && externalId) {
      loadYouTube().then(YT => {
        if (cancelled) return
        const p = new YT.Player(mount, {
          videoId: externalId,
          width: '100%',
          height: '100%',
          host: 'https://www.youtube-nocookie.com',
          playerVars: { playsinline: 1, rel: 0, autoplay: autoPlay ? 1 : 0 },
          events: { onStateChange: e => { if (e.data === 0) ended.current?.() } },
        })
        driver.current = {
          seek: s => { p.seekTo(s, true); p.playVideo() },
          position: () => { try { return p.getCurrentTime() } catch { return 0 } },
        }
        teardown = () => p.destroy()
      }).catch(fail)
    } else if (source === 'soundcloud') {
      const frame = document.createElement('iframe')
      frame.title = `${title ?? 'Song'} on SoundCloud`
      frame.allow = 'autoplay'
      frame.style.width = '100%'
      frame.style.height = size === 'compact' ? '80px' : '166px'
      frame.style.border = '0'
      frame.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&visual=false&show_comments=false&color=%231f5a43&auto_play=${autoPlay}`
      mount.appendChild(frame)
      loadSoundCloud().then(SC => {
        if (cancelled) return
        const w = SC.Widget(frame)
        let pos = 0
        w.bind(SC.Widget.Events.PLAY_PROGRESS, e => { pos = (e?.currentPosition ?? 0) / 1000 })
        w.bind(SC.Widget.Events.FINISH, () => ended.current?.())
        driver.current = { seek: s => { w.seekTo(s * 1000); w.play() }, position: () => pos }
      }).catch(fail)
    }

    return () => {
      cancelled = true
      driver.current = null
      teardown()
      el.replaceChildren()
    }
  }, [source, externalId, url, title, size, autoPlay])

  if (failed) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
        className={cn('flex min-h-14 items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 text-sm font-bold text-gray-700 hover:bg-gray-200', className)}>
        <ExternalLink className="h-4 w-4" /> Open in {SOURCE_NAMES[source]}
      </a>
    )
  }

  const box = source === 'youtube'
    ? (size === 'compact' ? 'aspect-video w-32 shrink-0' : 'aspect-video w-full')
    : size === 'compact' ? 'h-20 w-full' : source === 'spotify' ? 'h-[152px] w-full' : 'h-[166px] w-full'
  return <div ref={host} className={cn('overflow-hidden rounded-xl bg-gray-100', box, className)} />
})
