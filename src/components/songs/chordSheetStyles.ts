import { getCss } from '@/lib/chords/formatter'
import { getLightChordSheetCss } from '@/lib/chords/theme'

export const CHORD_VIEWER_CSS_ID = 'chord-viewer-css'

// The base sheet CSS is light-only (fixed hex colours), so everything colour- or size-related is
// re-pointed at theme variables here. Scoped to `.chord-view`, which the in-app sheet wrappers carry.
const THEME_OVERRIDES = `
.chord-view { color: var(--color-gray-900); }
.chord-view .chord-sheet { font-size: var(--chord-size, 14px); }
.chord-view .chord { color: var(--color-brand-400); }
.chord-view .comment { color: var(--color-gray-500); }
.chord-view .section-label { color: var(--color-gray-500); }
`

/** Injects the chord-sheet CSS once per page (shared by the viewer and the editor preview). */
export function ensureChordSheetCss() {
  if (document.getElementById(CHORD_VIEWER_CSS_ID)) return
  const style = document.createElement('style')
  style.id = CHORD_VIEWER_CSS_ID
  style.textContent = getCss() + '\n' + getLightChordSheetCss() + '\n' + THEME_OVERRIDES
  document.head.appendChild(style)
}
