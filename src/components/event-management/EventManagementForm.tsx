'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import type { EventManagementFormData } from '@/lib/validators'
import type { EventManagement } from '@/types'

interface EventManagementFormProps {
  company?: EventManagement
  onSubmit: (data: EventManagementFormData) => Promise<{ error?: string; id?: string } | void>
}

function fieldsFrom(company: EventManagement | undefined) {
  return {
    name: company?.name ?? '',
    contact_name: company?.contact_name ?? '',
    contact_phone: company?.contact_phone ?? '',
    contact_email: company?.contact_email ?? '',
    base_location: company?.base_location ?? '',
    notes: company?.notes ?? '',
  }
}

export function EventManagementForm({ company, onSubmit }: EventManagementFormProps) {
  const [fields, setFields] = useState(() => fieldsFrom(company))
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const set = <K extends keyof typeof fields>(key: K, value: typeof fields[K]) =>
    setFields(prev => ({ ...prev, [key]: value }))

  const canSubmit = fields.name.trim() !== ''

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)

    startTransition(async () => {
      const data: EventManagementFormData = {
        name: fields.name.trim(),
        contact_name: fields.contact_name.trim() || null,
        contact_phone: fields.contact_phone.trim() || null,
        contact_email: fields.contact_email.trim() || null,
        base_location: fields.base_location.trim() || null,
        notes: fields.notes.trim() || null,
      }
      const result = await onSubmit(data)
      if (result && 'error' in result && result.error) setError(result.error)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label htmlFor="name">Agency / Company Name *</Label>
        <Input id="name" className="mt-1" placeholder="Eventurox" value={fields.name}
          onChange={e => set('name', e.target.value)} />
      </div>
      <div>
        <Label htmlFor="base_location">Base location</Label>
        <Input id="base_location" placeholder="Bangalore" className="mt-1" value={fields.base_location}
          onChange={e => set('base_location', e.target.value)} />
      </div>

      <div className="space-y-4 rounded-lg border border-brand-200 bg-brand-50 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Contact</h3>
        <div>
          <Label htmlFor="contact_name">Contact person</Label>
          <Input id="contact_name" placeholder="Pavan" className="mt-1" value={fields.contact_name}
            onChange={e => set('contact_name', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="contact_phone">Phone</Label>
            <Input id="contact_phone" type="tel" placeholder="Optional" className="mt-1" value={fields.contact_phone}
              onChange={e => set('contact_phone', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="contact_email">Email</Label>
            <Input id="contact_email" type="email" placeholder="Optional" className="mt-1" value={fields.contact_email}
              onChange={e => set('contact_email', e.target.value)} />
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={3} placeholder="Anything else about this agency..." className="mt-1" value={fields.notes}
          onChange={e => set('notes', e.target.value)} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="secondary" onClick={() => history.back()}>Cancel</Button>
        <Button type="submit" loading={isPending} disabled={!canSubmit}>{company ? 'Save changes' : 'Add company'}</Button>
      </div>
    </form>
  )
}
