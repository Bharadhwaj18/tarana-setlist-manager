'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { setWorkspaceAvatar, updateWorkspaceDetails } from '@/actions/workspace'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { SegmentedTabs } from '@/components/ui/Chip'
import { useToast } from '@/components/ui/Toaster'
import { WorkspaceAvatar } from '@/components/ui/WorkspaceAvatar'
import { normaliseTone, type WorkspaceTone } from '@/lib/workspace-tones'
import { ToneSwatches } from './ToneSwatches'

const BUCKET = 'workspace-avatars'
const FRAME = 240
const OUTPUT = 512
const MAX_BYTES = 5 * 1024 * 1024
const PREVIEW_SIZES = [56, 40, 28, 20]

interface Props {
  workspaceId: string
  name: string
  color: string
  avatarUrl: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Mode = 'photo' | 'colour'

interface Picked {
  url: string
  width: number
  height: number
}

/** Where the (zoomed) image sits relative to the square frame, kept so the frame is always fully covered. */
function layout(picked: Picked, zoom: number, offset: { x: number; y: number }) {
  const scale = (FRAME / Math.min(picked.width, picked.height)) * zoom
  const dw = picked.width * scale
  const dh = picked.height * scale
  const x = Math.min(0, Math.max(FRAME - dw, offset.x))
  const y = Math.min(0, Math.max(FRAME - dh, offset.y))
  return { scale, dw, dh, x, y }
}

export function AvatarEditor({ workspaceId, name, color, avatarUrl, open, onOpenChange }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [mode, setMode] = useState<Mode>(avatarUrl ? 'photo' : 'colour')
  const [tone, setTone] = useState<WorkspaceTone>(normaliseTone(color))
  const [picked, setPicked] = useState<Picked | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => () => { if (picked) URL.revokeObjectURL(picked.url) }, [picked])

  const reset = () => { setPicked(null); setZoom(1); setOffset({ x: 0, y: 0 }); setError(null) }
  const close = (next: boolean) => { if (!next) reset(); onOpenChange(next) }

  const choose = (file: File | undefined) => {
    setError(null)
    if (!file) return
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { setError('Use a PNG, JPG or WebP image.'); return }
    if (file.size > MAX_BYTES) { setError('That image is over 5 MB. Pick a smaller one.'); return }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      setPicked({ url, width: img.naturalWidth, height: img.naturalHeight })
      setZoom(1)
      const l = layout({ url, width: img.naturalWidth, height: img.naturalHeight }, 1, { x: 0, y: 0 })
      setOffset({ x: (FRAME - l.dw) / 2, y: (FRAME - l.dh) / 2 })
    }
    img.onerror = () => { URL.revokeObjectURL(url); setError('Couldn’t read that image.') }
    img.src = url
  }

  const current = picked ? layout(picked, zoom, offset) : null

  const onPointerDown = (e: React.PointerEvent) => {
    if (!current) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { px: e.clientX, py: e.clientY, ox: current.x, oy: current.y }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    setOffset({ x: drag.current.ox + (e.clientX - drag.current.px), y: drag.current.oy + (e.clientY - drag.current.py) })
  }
  const onPointerUp = () => { drag.current = null }

  const changeZoom = (next: number) => {
    if (!picked || !current) { setZoom(next); return }
    // Zoom around the centre of the frame.
    const centreX = (FRAME / 2 - current.x) / current.scale
    const centreY = (FRAME / 2 - current.y) / current.scale
    const nextScale = (FRAME / Math.min(picked.width, picked.height)) * next
    setZoom(next)
    setOffset({ x: FRAME / 2 - centreX * nextScale, y: FRAME / 2 - centreY * nextScale })
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
    const sx = -current.x / current.scale
    const sy = -current.y / current.scale
    const size = FRAME / current.scale
    ctx.drawImage(img, sx, sy, size, size, 0, 0, OUTPUT, OUTPUT)
    for (const type of ['image/webp', 'image/jpeg']) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, 0.9))
      if (blob && blob.type === type) return { blob, type }
    }
    return null
  }

  const savePhoto = () => {
    setError(null)
    startTransition(async () => {
      try {
        const out = await cropToBlob()
        if (!out) { setError('Couldn’t prepare that image. Try another one.'); return }
        const ext = out.type === 'image/webp' ? 'webp' : 'jpg'
        const path = `${workspaceId}/${crypto.randomUUID()}.${ext}`
        const supabase = createClient()
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, out.blob, { contentType: out.type, upsert: false })
        if (uploadError) {
          const missing = /bucket not found|not found/i.test(uploadError.message)
          const message = missing ? 'Photo uploads aren’t switched on yet. Run the workspace profile SQL first.' : uploadError.message
          setError(message)
          toast(message, 'error')
          return
        }
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
        const res = await setWorkspaceAvatar(data.publicUrl)
        if (res.error) { setError(res.error); toast(res.error, 'error'); return }
        toast('Logo updated', 'success')
        reset()
        onOpenChange(false)
        router.refresh()
      } catch {
        setError('Something went wrong while uploading. Try again.')
      }
    })
  }

  const removePhoto = () => {
    setError(null)
    startTransition(async () => {
      const res = await setWorkspaceAvatar(null)
      if (res.error) { setError(res.error); toast(res.error, 'error'); return }
      toast('Photo removed', 'success')
      setMode('colour')
      router.refresh()
    })
  }

  const saveColour = () => {
    setError(null)
    startTransition(async () => {
      const res = await updateWorkspaceDetails({ color: tone, avatarUrl: null })
      if (res.error) { setError(res.error); toast(res.error, 'error'); return }
      toast('Colour saved', 'success')
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Modal
      open={open}
      onOpenChange={close}
      title="Workspace logo"
      description="A square photo or logo, or just a colour with the first letter."
      className="max-w-xl max-sm:top-auto max-sm:bottom-0 max-sm:max-w-none max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-3xl"
    >
      <SegmentedTabs<Mode>
        tabs={[{ value: 'photo', label: 'Photo' }, { value: 'colour', label: 'Colour & initial' }]}
        value={mode}
        onChange={setMode}
        className="mb-5"
      />

      {mode === 'photo' ? (
        <div className="space-y-4">
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { choose(e.target.files?.[0]); e.target.value = '' }} />

          {!picked ? (
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); choose(e.dataTransfer.files?.[0]) }}
              className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50 px-4 py-8 text-center"
            >
              {avatarUrl ? <WorkspaceAvatar name={name} color={color} avatarUrl={avatarUrl} size="xl" /> : <ImagePlus className="h-9 w-9 text-brand-300" />}
              <div>
                <p className="text-sm font-bold text-gray-800">Drop an image here, or choose a file</p>
                <p className="mt-0.5 text-xs text-gray-500">PNG, JPG or WebP, up to 5 MB</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button type="button" onClick={() => fileInput.current?.click()}>Choose image</Button>
                {avatarUrl && <Button type="button" variant="secondary" onClick={removePhoto} loading={pending}><Trash2 className="h-4 w-4" /> Remove photo</Button>}
              </div>
            </div>
          ) : (
            current && (
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                <div className="space-y-3">
                  <div
                    role="img"
                    aria-label="Drag to position your photo"
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    className="relative cursor-grab touch-none overflow-hidden rounded-3xl bg-gray-100 ring-1 ring-brand-200 active:cursor-grabbing"
                    style={{ width: FRAME, height: FRAME }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={picked.url} alt="" draggable={false} className="pointer-events-none absolute max-w-none select-none" style={{ width: current.dw, height: current.dh, left: current.x, top: current.y }} />
                  </div>
                  <label className="flex items-center gap-3 text-xs font-semibold text-gray-600">
                    Zoom
                    <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={e => changeZoom(Number(e.target.value))} className="flex-1 accent-brand-400" />
                  </label>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-500">Preview</p>
                  <div className="flex items-end gap-3">
                    {PREVIEW_SIZES.map(px => {
                      const f = px / FRAME
                      return (
                        <div
                          key={px}
                          className="shrink-0 ring-1 ring-brand-200"
                          style={{
                            width: px, height: px, borderRadius: Math.round(px * 0.28),
                            backgroundImage: `url(${picked.url})`, backgroundRepeat: 'no-repeat',
                            backgroundSize: `${current.dw * f}px ${current.dh * f}px`, backgroundPosition: `${current.x * f}px ${current.y * f}px`,
                          }}
                        />
                      )
                    })}
                  </div>
                  <button type="button" onClick={reset} className="text-xs font-semibold text-gray-500 underline hover:text-gray-700">Choose a different image</button>
                </div>
              </div>
            )
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => close(false)} disabled={pending}>Cancel</Button>
            <Button type="button" onClick={savePhoto} loading={pending} disabled={!picked}>Save logo</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <WorkspaceAvatar name={name} color={tone} size="xl" />
            <div className="flex items-end gap-3">
              {[40, 28, 20].map(px => <WorkspaceAvatar key={px} name={name} color={tone} size={px} />)}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-bold text-gray-800">Colour</p>
            <ToneSwatches value={tone} onChange={setTone} disabled={pending} />
          </div>
          {avatarUrl && <p className="text-xs text-gray-500">Saving a colour replaces the current photo.</p>}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => close(false)} disabled={pending}>Cancel</Button>
            <Button type="button" onClick={saveColour} loading={pending}>Use this colour</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
