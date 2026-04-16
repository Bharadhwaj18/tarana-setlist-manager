'use client'

import { useRef, useState } from 'react'
import { FileDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { exportElementToPdf } from '@/lib/pdf/exportPdf'
import { useToast } from '@/components/ui/Toaster'
import type { Setlist, Song } from '@/types'

interface SetlistPdfExportProps {
  setlist: Setlist
  songs: Song[]
}

export function SetlistPdfExport({ setlist, songs }: SetlistPdfExportProps) {
  const printRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const handleExport = async () => {
    if (!printRef.current) return
    setLoading(true)
    try {
      const filename = `${setlist.title.replace(/\s+/g, '-').toLowerCase()}-setlist.pdf`
      await exportElementToPdf(printRef.current, filename)
    } catch {
      toast('PDF export failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  const date = setlist.show_date
    ? new Date(setlist.show_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <>
      <Button variant="secondary" size="sm" loading={loading} onClick={handleExport}>
        <FileDown className="h-4 w-4" /> PDF
      </Button>

      {/* Hidden print target */}
      <div className="fixed -left-[9999px] top-0 w-[794px] bg-white p-10" aria-hidden>
        <div ref={printRef}>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{setlist.title}</h1>
          {(date || setlist.venue) && (
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
              {date}{date && setlist.venue ? ' · ' : ''}{setlist.venue}
            </p>
          )}
          {setlist.notes && (
            <p style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic', marginBottom: 20 }}>{setlist.notes}</p>
          )}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '8px 4px', fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', width: 32 }}>#</th>
                <th style={{ textAlign: 'left', padding: '8px 4px', fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Title</th>
                <th style={{ textAlign: 'left', padding: '8px 4px', fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Artist</th>
                <th style={{ textAlign: 'center', padding: '8px 4px', fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Key</th>
                <th style={{ textAlign: 'center', padding: '8px 4px', fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>BPM</th>
              </tr>
            </thead>
            <tbody>
              {songs.map((song, i) => (
                <tr key={song.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 4px', fontSize: 13, color: '#9ca3af' }}>{i + 1}</td>
                  <td style={{ padding: '10px 4px', fontSize: 14, fontWeight: 600, color: '#111827' }}>{song.title}</td>
                  <td style={{ padding: '10px 4px', fontSize: 13, color: '#6b7280' }}>{song.artist ?? '—'}</td>
                  <td style={{ padding: '10px 4px', fontSize: 13, fontWeight: 700, color: '#4f46e5', textAlign: 'center' }}>{song.song_key ?? '—'}</td>
                  <td style={{ padding: '10px 4px', fontSize: 13, color: '#6b7280', textAlign: 'center' }}>{song.bpm ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ marginTop: 24, fontSize: 11, color: '#d1d5db', textAlign: 'right' }}>Tarana Setlist Manager</p>
        </div>
      </div>
    </>
  )
}
