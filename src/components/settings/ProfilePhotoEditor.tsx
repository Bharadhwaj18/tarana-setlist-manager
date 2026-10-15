'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, ImagePlus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { setProfileAvatar } from '@/actions/profile'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toaster'
import { UserAvatar } from '@/components/ui/UserAvatar'

const BUCKET = 'profile-avatars'
const FRAME = 240
const OUTPUT = 512
const MAX_BYTES = 5 * 1024 * 1024

interface Picked { url: string; width: number; height: number }

interface Props {
  userId: string
  name: string
  avatarUrl: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Where the zoomed image sits in the round frame, kept so the frame is always covered. */
function layout(picked: Picked, zoom: number, offset: { x: number; y: number }) {
  const scale = (FRAME / Math.min(picked.width, picked.height)) * zoom
  const dw = picked.width * scale
  const dh = picked.height * scale
  return { scale, dw, dh, x: Math.min(0, Math.max(FRAME - dw, offset.x)), y: Math.min(0, Math.max(FRAME - dh, offset.y)) }
}

/** Take or choose a photo, move and zoom it into the circle, and save it as your profile photo. */
export function ProfilePhotoEditor({ userId, name, avatarUrl, open, onOpenChange }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [picked, setPicked] = useState<Picked | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => () => { if (picked) URL.revokeObjectURL(picked.url) }, [picked])

  const reset = () => { setPicked(null); setZoom(1); setOffset({ x: 0, y: 0 }); setError(null) }
  const close = (next: boolean) => { if (!next) reset(); onOpenChange(next) }

  const choose = (file: File | undefined) => {
    setError(null)
    if (!file) return
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { setError('Use a PNG, JPG or WebP photo.'); return }
    if (file.size > MAX_BYTES) { setError('That photo is over 5 MB. Pick a smaller one.'); return }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const p = { url, width: img.naturalWidth, height: img.naturalHeight }
      setPicked(p)
      setZoom(1)
      const l = layout(p, 1, { x: 0, y: 0 })
      setOffset({ x: (FRAME - l.dw) / 2, y: (FRAME - l.dh) / 2 })
    }
    img.onerror = () => { URL.revokeObjectURL(url); setError('Couldn’t read that photo.') }
    img.src = url
  }

  const current = picked ? layout(picked, zoom, offset) : null

  const changeZoom = (next: number) => {
    if (!picked || !current) { setZoom(next); return }
    const cx = (FRAME / 2 - current.x) / current.scale
    const cy = (FRAME / 2 - current.y) / current.scale
    const nextScale = (FRAME / Math.min(picked.width, picked.height)) * next
    setZoom(next)
    setOffset({ x: FRAME / 2 - cx * nextScale, y: FRAME / 2 - cy * nextScale })
  }

  const cropToBlob = async (): Promise<{ blob: Blob; type: string } | null> => {
    if (!picked || !current) return null
    const img = new Image()
    img.src = picked.url
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT
    canvas.height = OUTPUT
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, -current.x / current.scale, -current.y / current.scale, FRAME / current.scale, FRAME / current.scale, 0, 0, OUTPUT, OUTPUT)
    for (const type of ['image/webp', 'image/jpeg']) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, 0.9))
      if (blob && blob.type === type) return { blob, type }
    }
    return null
  }

  const save = () => {
    setError(null)
    startTransition(async () => {
      try {
        const out = await cropToBlob()
        if (!out) { setError('Couldn’t prepare that photo. Try another one.'); return }
        const path = `${userId}/${crypto.randomUUID()}.${out.type === 'image/webp' ? 'webp' : 'jpg'}`
        const supabase = createClient()
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, out.blob, { contentType: out.type, upsert: false })
        if (uploadError) {
          setError(/bucket not found|not found/i.test(uploadError.message) ? 'Profile photos aren’t switched on yet. Run the profile photos SQL first.' : uploadError.message)
          return
        }
        const res = await setProfileAvatar(supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl)
        if (res.error) { setError(res.error); return }
        toast('Photo updated', 'success')
        close(false)
        router.refresh()
      } catch {
        setError('Something went wrong while uploading. Try again.')
      }
    })
  }

  const remove = () => {
    setError(null)
    startTransition(async () => {
      const res = await setProfileAvatar(null)
      if (res.error) { setError(res.error); return }
      toast('Photo removed', 'success')
      close(false)
      router.refresh()
    })
  }

  return (
    <Modal open={open} onOpenChange={close} title="Profile photo"
      className="max-w-md max-sm:top-auto max-sm:bottom-0 max-sm:max-w-none max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-3xl">
      {/* "capture" opens the camera straight away on phones; the other input opens the photo library. */}
      <input ref={cameraInput} type="file" accept="image/*" capture="user" className="hidden" onChange={e => { choose(e.target.files?.[0]); e.target.value = '' }} />
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { choose(e.target.files?.[0]); e.target.value = '' }} />

      {!picked || !current ? (
        <div className="mt-4 space-y-4">
          <div className="flex justify-center"><UserAvatar name={name} id={userId} avatarUrl={avatarUrl} size={96} /></div>
          <div className="overflow-hidden rounded-2xl border border-brand-200">
            <button type="button" onClick={() => cameraInput.current?.click()} className="flex min-h-14 w-full items-center gap-3 border-b border-brand-100 px-4 text-left text-base font-bold text-gray-900 hover:bg-brand-50">
              <Camera className="h-5 w-5 text-brand-600" /> Take a photo
            </button>
            <button type="button" onClick={() => fileInput.current?.click()} className="flex min-h-14 w-full items-center gap-3 px-4 text-left text-base font-bold text-gray-900 hover:bg-brand-50">
              <ImagePlus className="h-5 w-5 text-brand-600" /> Choose from your photos
            </button>
            {avatarUrl && (
              <button type="button" onClick={remove} disabled={pending} className="flex min-h-14 w-full items-center gap-3 border-t border-brand-100 px-4 text-left text-base font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">
                <Trash2 className="h-5 w-5" /> Remove photo
              </button>
            )}
          </div>
          <p className="text-center text-xs text-gray-500">You’ll be able to move and zoom it into the circle before saving.</p>
        </div>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-4">
          <div role="img" aria-label="Drag to position your photo"
            onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { px: e.clientX, py: e.clientY, ox: current.x, oy: current.y } }}
            onPointerMove={e => { if (drag.current) setOffset({ x: drag.current.ox + (e.clientX - drag.current.px), y: drag.current.oy + (e.clientY - drag.current.py) }) }}
            onPointerUp={() => { drag.current = null }}
            className="relative cursor-grab touch-none overflow-hidden rounded-full bg-gray-100 ring-1 ring-brand-200 active:cursor-grabbing"
            style={{ width: FRAME, height: FRAME }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={picked.url} alt="" draggable={false} className="pointer-events-none absolute max-w-none select-none" style={{ width: current.dw, height: current.dh, left: current.x, top: current.y }} />
          </div>
          <label className="flex w-full max-w-[240px] items-center gap-3 text-xs font-semibold text-gray-600">
            Zoom
            <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={e => changeZoom(Number(e.target.value))} className="flex-1 accent-brand-400" />
          </label>
          <button type="button" onClick={reset} className="text-xs font-semibold text-gray-500 underline hover:text-gray-700">Choose a different photo</button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {picked && (
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => close(false)} disabled={pending}>Cancel</Button>
          <Button type="button" onClick={save} loading={pending}>Save photo</Button>
        </div>
      )}
    </Modal>
  )
}
