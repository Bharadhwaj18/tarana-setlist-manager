'use client'

import { useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { setlistSchema, type SetlistFormData } from '@/lib/validators'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import type { Setlist } from '@/types'

interface SetlistFormProps {
  setlist?: Setlist
  onSubmit: (data: SetlistFormData) => Promise<void>
}

export function SetlistForm({ setlist, onSubmit }: SetlistFormProps) {
  const [isPending, startTransition] = useTransition()

  const { register, handleSubmit, formState: { errors } } = useForm<SetlistFormData>({
    resolver: zodResolver(setlistSchema),
    defaultValues: {
      title: setlist?.title ?? '',
      show_date: setlist?.show_date ?? '',
      venue: setlist?.venue ?? '',
      notes: setlist?.notes ?? '',
    },
  })

  const handleFormSubmit = (data: SetlistFormData) => {
    startTransition(async () => { await onSubmit(data) })
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
      <div>
        <Label htmlFor="title">Setlist Title *</Label>
        <Input id="title" className="mt-1" placeholder="Night at The Forum" error={errors.title?.message} {...register('title')} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="show_date">Show Date</Label>
          <Input id="show_date" type="date" className="mt-1" {...register('show_date')} />
        </div>
        <div>
          <Label htmlFor="venue">Venue</Label>
          <Input id="venue" placeholder="Blue Frog" className="mt-1" {...register('venue')} />
        </div>
      </div>
      <div>
        <Label htmlFor="notes">Notes</Label>
        <textarea
          id="notes"
          rows={3}
          placeholder="Set length, special requests..."
          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          {...register('notes')}
        />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={() => history.back()}>Cancel</Button>
        <Button type="submit" loading={isPending}>{setlist ? 'Save changes' : 'Create setlist'}</Button>
      </div>
    </form>
  )
}
