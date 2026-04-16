'use client'

import { useForm, Controller, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { songSchema, type SongFormData } from '@/lib/validators'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { ChordEditor } from './ChordEditor'
import { MUSICAL_KEYS, TIME_SIGNATURES } from '@/lib/utils'
import type { Song } from '@/types'
import { useTransition } from 'react'

interface SongFormProps {
  song?: Song
  onSubmit: (data: SongFormData) => Promise<void>
}

export function SongForm({ song, onSubmit }: SongFormProps) {
  const [isPending, startTransition] = useTransition()

  const { register, handleSubmit, control, formState: { errors } } = useForm<SongFormData>({
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

  const handleFormSubmit = (data: SongFormData) => {
    startTransition(async () => {
      await onSubmit(data)
    })
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Title */}
      <div>
        <Label htmlFor="title">Song Title *</Label>
        <Input id="title" className="mt-1" error={errors.title?.message} {...register('title')} />
      </div>

      {/* Artist */}
      <div>
        <Label htmlFor="artist">Artist</Label>
        <Input id="artist" placeholder="Original artist" className="mt-1" {...register('artist')} />
      </div>

      {/* Key + BPM + Time Sig row */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="song_key">Key</Label>
          <select
            id="song_key"
            className="mt-1 w-full rounded-md border border-brand-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
            {...register('song_key')}
          >
            <option value="">—</option>
            {MUSICAL_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="bpm">BPM</Label>
          <Input id="bpm" type="number" min={20} max={280} placeholder="120" className="mt-1" error={errors.bpm?.message} {...register('bpm', { setValueAs: (v: string) => v === '' ? undefined : parseInt(v, 10) })} />
        </div>
        <div>
          <Label htmlFor="time_signature">Time Sig.</Label>
          <select
            id="time_signature"
            className="mt-1 w-full rounded-md border border-brand-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
            {...register('time_signature')}
          >
            {TIME_SIGNATURES.map(ts => <option key={ts} value={ts}>{ts}</option>)}
          </select>
        </div>
      </div>

      {/* Chord chart */}
      <div>
        <Label>Chord Chart</Label>
        <div className="mt-1">
          <Controller
            name="chord_chart"
            control={control}
            render={({ field }) => (
              <ChordEditor value={field.value ?? ''} onChange={field.onChange} error={errors.chord_chart?.message} />
            )}
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <Label htmlFor="notes">Rehearsal Notes</Label>
        <textarea
          id="notes"
          rows={3}
          placeholder="Capo, special instructions, dynamics..."
          className="mt-1 w-full rounded-md border border-brand-200 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
          {...register('notes')}
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={() => history.back()}>Cancel</Button>
        <Button type="submit" loading={isPending}>{song ? 'Save changes' : 'Create song'}</Button>
      </div>
    </form>
  )
}
