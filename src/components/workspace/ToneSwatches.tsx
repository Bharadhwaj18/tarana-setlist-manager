'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WORKSPACE_TONE_IDS, WORKSPACE_TONES, type WorkspaceTone } from '@/lib/workspace-tones'

/** The six workspace colours as a row of selectable tiles. */
export function ToneSwatches({ value, onChange, disabled }: { value: WorkspaceTone; onChange: (tone: WorkspaceTone) => void; disabled?: boolean }) {
  return (
    <div role="radiogroup" aria-label="Workspace colour" className="flex flex-wrap gap-2.5">
      {WORKSPACE_TONE_IDS.map(tone => (
        <button
          key={tone}
          type="button"
          role="radio"
          aria-checked={value === tone}
          aria-label={WORKSPACE_TONES[tone].label}
          title={WORKSPACE_TONES[tone].label}
          disabled={disabled}
          onClick={() => onChange(tone)}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-xl transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
            WORKSPACE_TONES[tone].tile,
            value === tone ? 'ring-2 ring-brand-400 ring-offset-2 ring-offset-white' : 'opacity-90 hover:opacity-100'
          )}
        >
          {value === tone && <Check className="h-4 w-4" />}
        </button>
      ))}
    </div>
  )
}
