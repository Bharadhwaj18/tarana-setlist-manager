// Single source of truth for the decorative CSS applied to a rendered chord
// sheet (the `.chord`, `.paragraph`, `.row`, `.column`, `.comment` and
// `.section-label` classes that `getCss()`'s structural rules don't cover).
// Previously this was hand-duplicated across ChordViewer, PerformanceMode
// and SongPdfExport — any tweak had to be repeated three times and could
// drift between them. Each theme's exact values are preserved as they were.

export interface ChordSheetThemeConfig {
  /** CSS selector prefix scoping every rule, e.g. '.perf-sheet ' — '' for none. */
  prefix?: string
  /** Omit to leave `.chord-sheet` font rules to the surrounding page (e.g. print, which sets them on `body`). */
  fontSize?: number
  fontFamily?: string
  lineHeight?: number
  textColor?: string
  chordColor: string
  /** Chord font size in px — omit to inherit the sheet's own size. */
  chordFontSize?: number
  columnGap: string
  paragraphMarginBottom: string
  commentColor: string
  commentMarginBottom?: string
  sectionLabel: {
    color: string
    fontWeight: number
    letterSpacing: string
    marginBottom: string
  }
}

export function buildChordSheetCss(config: ChordSheetThemeConfig): string {
  const p = config.prefix ?? ''
  const rules: string[] = []

  if (config.fontSize !== undefined) {
    rules.push(`${p}.chord-sheet { font-family: ${config.fontFamily}; font-size: ${config.fontSize}px; line-height: ${config.lineHeight};${config.textColor ? ` color: ${config.textColor};` : ''} }`)
  }
  rules.push(`${p}.chord { color: ${config.chordColor}; font-weight: 700;${config.chordFontSize ? ` font-size: ${config.chordFontSize}px;` : ''} }`)
  rules.push(`${p}.paragraph { margin-bottom: ${config.paragraphMarginBottom}; }`)
  rules.push(`${p}.row { display: flex; flex-wrap: wrap; }`)
  rules.push(`${p}.column { display: flex; flex-direction: column; margin-right: ${config.columnGap}; }`)
  rules.push(`${p}.comment { color: ${config.commentColor}; font-style: italic;${config.commentMarginBottom ? ` margin-bottom: ${config.commentMarginBottom};` : ''} }`)
  rules.push(`${p}.section-label { font-weight: ${config.sectionLabel.fontWeight}; color: ${config.sectionLabel.color}; text-transform: uppercase; font-size: 0.75rem; letter-spacing: ${config.sectionLabel.letterSpacing}; margin-bottom: ${config.sectionLabel.marginBottom}; }`)

  return rules.join('\n')
}

/** Normal in-app song view (ChordViewer) — light background, fixed size. */
export function getLightChordSheetCss(): string {
  return buildChordSheetCss({
    fontFamily: 'monospace',
    fontSize: 14,
    lineHeight: 1.8,
    chordColor: '#d4a373',
    columnGap: '0.2rem',
    paragraphMarginBottom: '1.5rem',
    commentColor: '#6b7280',
    commentMarginBottom: '0.5rem',
    sectionLabel: { color: '#374151', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '0.25rem' },
  })
}

/** Fullscreen Performance mode — dark background, large adjustable font. */
export function getPerfChordSheetCss(fontSize: number): string {
  return buildChordSheetCss({
    prefix: '.perf-sheet ',
    fontFamily: "'Courier New', monospace",
    fontSize,
    lineHeight: 2.2,
    textColor: '#e5e7eb',
    chordColor: '#fbbf24',
    chordFontSize: Math.round(fontSize * 0.88),
    columnGap: '0.3rem',
    paragraphMarginBottom: '2.5rem',
    commentColor: '#4b5563',
    sectionLabel: { color: '#6ee7b7', fontWeight: 700, letterSpacing: '0.12em', marginBottom: '0.5rem' },
  })
}

/** Printable PDF export — font/size set on `body` by the caller instead of `.chord-sheet`. */
export function getPrintChordSheetCss(): string {
  return buildChordSheetCss({
    chordColor: '#c08d62',
    columnGap: '0.2rem',
    paragraphMarginBottom: '1.25rem',
    commentColor: '#6b7280',
    commentMarginBottom: '0.5rem',
    sectionLabel: { color: '#374151', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '0.25rem' },
  })
}
