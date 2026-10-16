'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { useForm, useWatch, Controller, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { songSchema, type SongFormData } from '@/lib/validators'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { ChordEditor } from './ChordEditor'
import { ChordPreview } from './ChordPreview'
import { DeleteSongButton } from './DeleteSongButton'
import { MUSICAL_KEYS, TIME_SIGNATURES } from '@/lib/utils'
import type { Song } from '@/types'
import { useRef, useTransition } from 'react'
import { StartFromLink } from '@/components/references/StartFromLink'
import type { ReferenceDetails } from '@/lib/reference-lookup'

interface SongFormProps {
  song?: Song
  onSubmit: (data: SongFormData) => Promise<void>
  title: string
  backHref: string
  backLabel: string
}

const selectClass =
  'mt-1 w-full rounded-md border border-brand-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400'

export function SongForm({ song, onSubmit, title, backHref, backLabel }: SongFormProps) {
  const [isPending, startTransition] = useTransition()

  const { register, handleSubmit, control, setValue, getValues, formState: { errors } } = useForm<SongFormData>({
    resolver: zodResolver(songSchema) as Resolver<SongFormData>,
    defaultValues: {
      title: song?.title ?? '',
      artist: song?.artist ?? '',
      song_key: song?.song_key ?? '',
      bpm: song?.bpm ?? undefined,
      time_signature: song?.time_signature ?? '4/4',
      chord_chart: song?.chord_chart ?? '',
      notes: song?.notes ?? '',
    },
  })
  const chart = useWatch({ control, name: 'chord_chart' }) ?? ''

  // What a pasted link last filled in, so a different link can replace it but never overwrite typed text.
  const filled = useRef<{ title?: string; artist?: string }>({})
  const fillFromLink = (d: ReferenceDetails | null) => {
    setValue('reference_url', d?.url ?? '')
    setValue('cover_url', d?.thumbnailUrl ?? '')
    if (!d) return
    const title = getValues('title')?.trim() ?? ''
    if (d.title && (!title || title === filled.current.title)) { setValue('title', d.title, { shouldValidate: true }); filled.current.title = d.title }
    // Only Spotify knows the artist; a YouTube or SoundCloud name is whoever uploaded it.
    const artist = getValues('artist')?.trim() ?? ''
    if (d.source === 'spotify' && d.artist && (!artist || artist === filled.current.artist)) { setValue('artist', d.artist); filled.current.artist = d.artist }
  }

  const handleFormSubmit = (data: SongFormData) => {
    startTransition(async () => {
      await onSubmit(data)
    })
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
      <div>
        <Link href={backHref} className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ChevronLeft className="h-4 w-4" /> {backLabel}
        </Link>
        <PageHeader
          title={title}
          className="mb-0"
          action={
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => history.back()}>Cancel</Button>
              <Button type="submit" loading={isPending}>{song ? 'Save song' : 'Create song'}</Button>
            </div>
          }
        />
      </div>

      {!song && (
        <>
          <StartFromLink onFound={fillFromLink} />
          <input type="hidden" {...register('reference_url')} />
          <input type="hidden" {...register('cover_url')} />
        </>
      )}

      {/* Details */}
      <div className="grid grid-cols-2 gap-4 rounded-2xl border border-brand-200 bg-white p-4 sm:grid-cols-6 sm:p-5">
        <div className="col-span-2 sm:col-span-3">
          <Label htmlFor="title">Title *</Label>
          <Input id="title" className="mt-1" error={errors.title?.message} {...register('title')} />
        </div>
        <div className="col-span-2 sm:col-span-3">
          <Label htmlFor="artist">Artist</Label>
          <Input id="artist" placeholder="Original artist" className="mt-1" {...register('artist')} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="song_key">Key</Label>
          <select id="song_key" className={selectClass} {...register('song_key')}>
            <option value="">—</option>
            {MUSICAL_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="bpm">Tempo (BPM)</Label>
          <Input id="bpm" type="number" min={20} max={280} placeholder="120" className="mt-1" error={errors.bpm?.message} {...register('bpm', { setValueAs: (v: string) => v === '' ? undefined : parseInt(v, 10) })} />
        </div>
        <div className="col-span-2 sm:col-span-2">
          <Label htmlFor="time_signature">Time signature</Label>
          <select id="time_signature" className={selectClass} {...register('time_signature')}>
            {TIME_SIGNATURES.map(ts => <option key={ts} value={ts}>{ts}</option>)}
          </select>
        </div>
        <div className="col-span-2 sm:col-span-6">
          <Label htmlFor="notes">Band notes</Label>
          <textarea
            id="notes"
            rows={2}
            placeholder="Capo, special instructions, dynamics..."
            className="mt-1 w-full rounded-md border border-brand-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
            {...register('notes')}
          />
        </div>
      </div>

      {/* Chord chart: editor beside a live preview (stacked on phones) */}
      <div>
        <SectionLabel className="mb-2">Chord chart</SectionLabel>
        <div className="grid gap-4 lg:grid-cols-2">
          <Controller
            name="chord_chart"
            control={control}
            render={({ field }) => (
              <ChordEditor value={field.value ?? ''} onChange={field.onChange} error={errors.chord_chart?.message} />
            )}
          />
          <ChordPreview chart={chart} />
        </div>
      </div>

      {song && (
        <div className="flex items-center justify-between border-t border-brand-200 pt-4">
          <span className="text-xs text-gray-400">Changes are saved when you press Save song</span>
          <DeleteSongButton id={song.id} />
        </div>
      )}
    </form>
  )
}
