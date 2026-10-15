import { describe, it, expect } from 'vitest'
import { getLightChordSheetCss, getStageChordSheetCss, getPrintChordSheetCss } from './theme'

// These lock in the exact values that were previously hand-duplicated across
// ChordViewer, Stage mode and SongPdfExport, so consolidating them into
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
    expect(css).not.toContain('.stage-sheet')
  })
})

describe('getStageChordSheetCss (Stage mode)', () => {
  const css = getStageChordSheetCss(24)

  it('scopes every rule under .stage-sheet', () => {
    expect(css).toContain('.stage-sheet .chord-sheet')
    expect(css).toContain('.stage-sheet .chord ')
    expect(css).toContain('.stage-sheet .section-label')
  })

  it('scales the chord size relative to the sheet font size', () => {
    expect(css).toContain('font-size: 24px')
    expect(css).toContain('font-size: 22px') // round(24 * 0.9)
  })

  it('takes its colours from the stage palette, not the app theme', () => {
    expect(css).toContain('color: var(--stage-chord)')
    expect(css).toContain('color: var(--stage-text)')
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
