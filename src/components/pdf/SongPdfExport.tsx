'use client'

import { useRef, useState } from 'react'
import { FileDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ChordViewer } from '@/components/songs/ChordViewer'
import { exportElementToPdf } from '@/lib/pdf/exportPdf'
import { useToast } from '@/components/ui/Toaster'
import type { Song } from '@/types'

interface SongPdfExportProps {
  song: Song
}

export function SongPdfExport({ song }: SongPdfExportProps) {
  const printRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const handleExport = async () => {
    if (!printRef.current) return
    setLoading(true)
    try {
      await exportElementToPdf(printRef.current, `${song.title.replace(/\s+/g, '-').toLowerCase()}.pdf`)
    } catch {
      toast('PDF export failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" loading={loading} onClick={handleExport}>
        <FileDown className="h-4 w-4" /> PDF
      </Button>

      {/* Hidden print target — always rendered so the ref is stable */}
      <div className="fixed -left-[9999px] top-0 w-[794px] bg-white p-10 text-sm font-mono" aria-hidden>
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{song.title}</h1>
          {song.artist && <p className="text-gray-500">{song.artist}</p>}
          <div className="mt-2 flex gap-4 text-xs text-gray-400">
            {song.song_key && <span>Key: {song.song_key}</span>}
            {song.bpm && <span>BPM: {song.bpm}</span>}
            {song.time_signature && <span>Time: {song.time_signature}</span>}
          </div>
          {song.notes && <p className="mt-2 text-xs italic text-gray-500">Notes: {song.notes}</p>}
        </div>
        <div ref={printRef}>
          <ChordViewer chordChart={song.chord_chart ?? ''} />
        </div>
      </div>
    </>
  )
}
