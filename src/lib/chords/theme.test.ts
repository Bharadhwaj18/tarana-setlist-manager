import { describe, it, expect } from 'vitest'
import { getLightChordSheetCss, getPerfChordSheetCss, getPrintChordSheetCss } from './theme'

// These lock in the exact values that were previously hand-duplicated across
// ChordViewer, PerformanceMode and SongPdfExport, so consolidating them into
// one generator can't silently drift a theme's actual appearance.

describe('getLightChordSheetCss (ChordViewer)', () => {
  const css = getLightChordSheetCss()

  it('sets the fixed light-mode sheet font', () => {
    expect(css).toContain('.chord-sheet { font-family: monospace; font-size: 14px; line-height: 1.8; }')
  })

  it('sets the tan chord color', () => {
    expect(css).toContain('.chord { color: #d4a373; font-weight: 700; }')
  })

  it('is not scoped under any parent selector', () => {
    expect(css).not.toContain('.perf-sheet')
  })
})

describe('getPerfChordSheetCss (PerformanceMode)', () => {
  const css = getPerfChordSheetCss(24)

  it('scopes every rule under .perf-sheet', () => {
    expect(css).toContain('.perf-sheet .chord-sheet')
    expect(css).toContain('.perf-sheet .chord ')
    expect(css).toContain('.perf-sheet .section-label')
  })

  it('scales the chord size relative to the sheet font size', () => {
    expect(css).toContain('font-size: 24px')
    expect(css).toContain('font-size: 21px') // round(24 * 0.88)
  })

  it('uses the dark-mode amber chord color', () => {
    expect(css).toContain('color: #fbbf24')
  })
})

describe('getPrintChordSheetCss (SongPdfExport)', () => {
  const css = getPrintChordSheetCss()

  it('does not set a .chord-sheet font rule (the print HTML sets it on body)', () => {
    expect(css).not.toContain('.chord-sheet {')
  })

  it('uses the print-specific chord color and paragraph spacing', () => {
    expect(css).toContain('.chord { color: #c08d62; font-weight: 700; }')
    expect(css).toContain('.paragraph { margin-bottom: 1.25rem; }')
  })
})
