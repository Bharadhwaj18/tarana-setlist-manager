'use client'

import { useState, useRef } from 'react'
import { ChevronDown, ChevronUp, FileUp, Loader2 } from 'lucide-react'
import { Textarea } from '@/components/ui/Textarea'
import ChordSheetJS from 'chordsheetjs'

interface ChordEditorProps {
  value: string
  onChange: (value: string) => void
  error?: string
}

// Extract text from PDF preserving horizontal spacing (for chord alignment)
async function extractPdfText(file: File): Promise<string> {
  // Dynamic import avoids SSR issues; CDN worker avoids bundler complexity
  const pdfjs = await import('pdfjs-dist')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(pdfjs as any).GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.mjs`

  const arrayBuffer = await file.arrayBuffer()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdf = await (pdfjs as any).getDocument({ data: arrayBuffer }).promise

  // Two-pass: first collect everything, then reconstruct
  type RawItem = { y: number; x: number; str: string; charW: number }
  const rawItems: RawItem[] = []
  let pageYOffset = 0

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    const viewport = page.getViewport({ scale: 1 })
    const pageHeight = viewport.height

    // Offset each page so lines don't collide across pages
    // (page 1 is at the top, so we add height of previous pages)
    for (const item of content.items) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const it = item as any
      if (!it.str || !it.str.trim()) continue
      const x = it.transform[4]
      // PDF Y=0 is at bottom; flip and offset by page
      const y = pageYOffset + (pageHeight - it.transform[5])
      const charW = it.str.length > 0 && it.width > 0
        ? it.width / it.str.length
        : 7
      rawItems.push({ y: Math.round(y), x, str: it.str, charW })
    }

    pageYOffset += pageHeight + 50 // gap between pages
  }

  if (rawItems.length === 0) return ''

  // Find global left margin and representative char width
  const minX = Math.min(...rawItems.map(i => i.x))
  // Weighted average char width
  let totalW = 0, totalLen = 0
  for (const i of rawItems) { totalW += i.charW * i.str.length; totalLen += i.str.length }
  const charWidth = Math.max(4, Math.min(totalLen > 0 ? totalW / totalLen : 7, 14))

  // Group by Y line (within 2 units = same line)
  const lineMap = new Map<number, { x: number; str: string }[]>()
  for (const item of rawItems) {
    // Find an existing line within ±2 y units
    let lineKey = item.y
    for (const key of lineMap.keys()) {
      if (Math.abs(key - item.y) <= 2) { lineKey = key; break }
    }
    if (!lineMap.has(lineKey)) lineMap.set(lineKey, [])
    lineMap.get(lineKey)!.push({ x: item.x, str: item.str })
  }

  // Sort lines top-to-bottom, reconstruct with spacing
  return Array.from(lineMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([, items]) => {
      items.sort((a, b) => a.x - b.x)
      let line = ''
      for (const { x, str } of items) {
        const pos = Math.max(0, Math.round((x - minX) / charWidth))
        while (line.length < pos) line += ' '
        line += str
      }
      return line.trimEnd()
    })
    .join('\n')
}

// Try to convert chords-over-words text to ChordPro, fall back to raw text
function toChordPro(raw: string): string {
  try {
    const song = new ChordSheetJS.ChordsOverWordsParser().parse(raw)
    return new ChordSheetJS.ChordProFormatter().format(song)
  } catch {
    return raw
  }
}

export function ChordEditor({ value, onChange, error }: ChordEditorProps) {
  const [showRef, setShowRef] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportMsg(null)
    try {
      const raw = await extractPdfText(file)
      if (!raw.trim()) {
        setImportMsg({ type: 'err', text: 'No text found in PDF. Try copying the chords manually.' })
        return
      }
      const chordPro = toChordPro(raw)
      onChange(chordPro)
      setImportMsg({ type: 'ok', text: 'Imported — review and adjust the chart below.' })
    } catch (err) {
      console.error('PDF import failed:', err)
      setImportMsg({ type: 'err', text: 'Could not read PDF. Try a different file or paste the chords manually.' })
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-2">
      {/* PDF import row */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handlePdfUpload}
        />
        <button
          type="button"
          onClick={() => { setImportMsg(null); fileRef.current?.click() }}
          disabled={importing}
          className="flex items-center gap-1.5 rounded-md border border-brand-200 bg-white px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50"
        >
          {importing
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading PDF…</>
            : <><FileUp className="h-3.5 w-3.5" /> Import from PDF</>
          }
        </button>
        {importMsg && (
          <span className={`text-xs ${importMsg.type === 'ok' ? 'text-green-600' : 'text-red-500'}`}>
            {importMsg.text}
          </span>
        )}
      </div>

      <Textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={16}
        placeholder={`Enter chords in ChordPro format, e.g.:\n\n{title: Amazing Grace}\n{key: G}\n\n[G]Amazing grace, [D]how sweet [Em]the sound\n[C]That saved a [G]wretch like me`}
        className="font-mono text-sm"
        error={error}
      />

      <button
        type="button"
        onClick={() => setShowRef(v => !v)}
        className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-700"
      >
        {showRef ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        ChordPro syntax reference
      </button>
      {showRef && (
        <div className="rounded-lg bg-brand-50 border border-brand-200 p-4 text-xs text-brand-700 space-y-2 font-mono">
          <p><span className="text-brand-500">[G]</span> — chord before a word</p>
          <p><span className="text-brand-500">{'{'}</span>title: Song Name<span className="text-brand-500">{'}'}</span> — song title</p>
          <p><span className="text-brand-500">{'{'}</span>key: G<span className="text-brand-500">{'}'}</span> — song key</p>
          <p><span className="text-brand-500">{'{'}</span>start_of_chorus<span className="text-brand-500">{'}'}</span> / <span className="text-brand-500">{'{'}</span>end_of_chorus<span className="text-brand-500">{'}'}</span></p>
          <p><span className="text-brand-500">{'{'}</span>start_of_verse<span className="text-brand-500">{'}'}</span> / <span className="text-brand-500">{'{'}</span>end_of_verse<span className="text-brand-500">{'}'}</span></p>
          <p><span className="text-brand-500">{'{'}</span>comment: Intro riff<span className="text-brand-500">{'}'}</span> — inline comment</p>
        </div>
      )}
    </div>
  )
}
