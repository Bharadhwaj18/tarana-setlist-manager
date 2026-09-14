'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, Phone, Mail, MapPin } from 'lucide-react'
import type { EventManagement } from '@/types'

interface Props {
  companies: EventManagement[]
  showCountByCompany: Record<string, number>
}

export function EventManagementSearchList({ companies, showCountByCompany }: Props) {
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const filtered = q
    ? companies.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.contact_name?.toLowerCase().includes(q) ||
        c.base_location?.toLowerCase().includes(q) ||
        c.contact_email?.toLowerCase().includes(q)
      )
    : companies

  return (
    <div>
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-300" />
        <input
          type="text"
          placeholder="Search by name, contact, or location…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full rounded-lg border border-brand-200 bg-white py-2.5 pl-9 pr-3 text-sm placeholder-gray-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">No agencies matching &quot;{query}&quot;</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map(c => {
            const showCount = showCountByCompany[c.id] ?? 0
            return (
              <Link
                key={c.id}
                href={`/event-management/${c.id}`}
                className="flex flex-col gap-2 rounded-xl border border-brand-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-400"
              >
                <p className="font-semibold text-gray-900">{c.name}</p>
                <div className="flex flex-col gap-1 text-xs text-gray-500">
                  {c.contact_name && <span>{c.contact_name}</span>}
                  {c.base_location && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{c.base_location}</span>}
                  {c.contact_phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{c.contact_phone}</span>}
                  {c.contact_email && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{c.contact_email}</span>}
                </div>
                <span className="mt-auto text-xs font-medium text-brand-600">
                  {showCount} show{showCount !== 1 ? 's' : ''} booked
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
