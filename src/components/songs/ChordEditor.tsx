'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Textarea } from '@/components/ui/Textarea'

interface ChordEditorProps {
  value: string
  onChange: (value: string) => void
  error?: string
}

export function ChordEditor({ value, onChange, error }: ChordEditorProps) {
  const [showRef, setShowRef] = useState(false)

  return (
    <div className="space-y-2">
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
