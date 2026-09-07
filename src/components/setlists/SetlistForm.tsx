'use client'

import { useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link2 } from 'lucide-react'
import { setlistSchema, type SetlistFormData } from '@/lib/validators'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import type { Setlist } from '@/types'

interface LinkedShow { id: string; title: string; show_date: string | null; venue: string | null }
interface SetlistFormProps {
  setlist?: Setlist
  onSubmit: (data: SetlistFormData) => Promise<void>
  /** Present when creating a setlist from a show's own page — pre-fills date/venue from the show and carries show_id through on submit. */
  linkedShow?: LinkedShow
}

export function SetlistForm({ setlist, onSubmit, linkedShow }: SetlistFormProps) {
  const [isPending, startTransition] = useTransition()

  const { register, handleSubmit, formState: { errors } } = useForm<SetlistFormData>({
    resolver: zodResolver(setlistSchema),
    defaultValues: {
      title: setlist?.title ?? (linkedShow ? linkedShow.title : ''),
      show_date: setlist?.show_date ?? linkedShow?.show_date ?? '',
      venue: setlist?.venue ?? linkedShow?.venue ?? '',
      notes: setlist?.notes ?? '',
      show_id: setlist?.show_id ?? linkedShow?.id ?? null,
    },
  })

  const handleFormSubmit = (data: SetlistFormData) => {
    startTransition(async () => { await onSubmit(data) })
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
      {linkedShow && (
        <div className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
          <Link2 className="h-4 w-4 shrink-0" />
          Linked to show <span className="font-semibold">{linkedShow.title}</span>
        </div>
      )}
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
