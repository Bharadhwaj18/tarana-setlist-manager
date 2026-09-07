import { jsPDF } from 'jspdf'

/**
 * A small, reusable wrapper around jsPDF for generating real, vector,
 * paginated documents — title/subtitle header on page 1, a slim repeated
 * header on every later page, a consistent footer with page numbers, and
 * generous empty margins reserved on every page so content never crowds
 * the edges. Used by the Finance "Export" statement and the Split "Report".
 *
 * Deliberately NOT html2canvas + raster-slicing: that approach screenshots
 * a DOM node and cuts the resulting image at blind pixel-height intervals,
 * which slices rows and cards in half at page boundaries and can't reserve
 * real header/footer space. Drawing text and shapes directly keeps every
 * page break row-aware and the output crisp at any zoom.
 */

export const PAGE_W = 210
export const PAGE_H = 297
export const MARGIN = { left: 16, right: 16, top: 30, bottom: 22 }
export const CONTENT_W = PAGE_W - MARGIN.left - MARGIN.right
export const CONTENT_BOTTOM = PAGE_H - MARGIN.bottom

// Tarana's own warm palette (see globals.css), not a generic report blue/purple.
export const COLORS = {
  ink: '#2a2116',
  sub: '#6b6153',
  faint: '#a89f8f',
  accent: '#a87a52', // brand-600
  accentDark: '#7a5436', // brand-700
  accentSoft: '#faedcd', // brand-300
  headBandFill: '#f5efdc',
  border: '#e6ddc8',
  positive: '#3f7d4a',
  negative: '#b3432b',
} as const

export interface PdfDocOptions {
  /** Big title on page 1's header. */
  title: string
  /** One or more lines shown under the title on page 1 only, smaller and muted. */
  subtitleLines?: string[]
  /** Short label repeated small in every page's footer (e.g. app + doc name). */
  footerNote: string
}

export class PdfDoc {
  readonly doc: jsPDF
  /** Current write cursor, in mm from the top of the page. */
  y: number = MARGIN.top
  private opts: PdfDocOptions

  constructor(opts: PdfDocOptions) {
    this.opts = opts
    this.doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    this.drawHeader()
  }

  /** Absolute page number the doc is currently on. */
  get pageNum() {
    return this.doc.getNumberOfPages()
  }

  /**
   * Draws (or redraws — harmless, identical pixels) the chrome for the
   * current page, and parks the cursor just below it. The header's real
   * height varies (page 1's title + N subtitle lines vs. a later page's
   * slim repeat), so the cursor is always derived from where the rule
   * actually landed, never a constant guess — otherwise a long subtitle
   * can push the rule below where content already started drawing.
   */
  drawHeader() {
    const { doc } = this
    const first = this.pageNum === 1
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(COLORS.ink)
    doc.setFontSize(first ? 18 : 11)
    doc.text(this.opts.title, MARGIN.left, first ? 15 : 12)

    let ruleY = first ? 22 : 16
    if (first && this.opts.subtitleLines?.length) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor(COLORS.sub)
      let ty = 21
      for (const line of this.opts.subtitleLines) {
        doc.text(line, MARGIN.left, ty)
        ty += 4.6
      }
      ruleY = ty + 1.5
    }

    doc.setDrawColor(COLORS.border)
    doc.setLineWidth(0.4)
    doc.line(MARGIN.left, ruleY, PAGE_W - MARGIN.right, ruleY)

    // Content never starts closer to the header than the standard top
    // margin (keeps a slim continuation-page header from looking cramped),
    // but yields to a taller header (e.g. a long subtitle) when it needs more.
    this.y = Math.max(MARGIN.top, ruleY + 5)
  }

  /** Call after any manual drawing to make sure autoTable-driven pages get the same header. Safe to pass as-is to autoTable's `didDrawPage`. */
  onAutoTablePageDrawn = () => {
    this.drawHeader()
  }

  newPage() {
    this.doc.addPage()
    this.drawHeader()
  }

  /** Ensures `height` mm of room remains below the cursor, starting a new page first if not. */
  ensure(height: number) {
    if (this.y + height > CONTENT_BOTTOM) this.newPage()
  }

  /** Sync the cursor/page bookkeeping after handing control to autoTable, which manages its own pagination. */
  syncAfterAutoTable(finalY: number) {
    this.y = finalY
  }

  sectionHeading(text: string) {
    this.ensure(10)
    const { doc } = this
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(COLORS.accentDark)
    doc.text(text, MARGIN.left, this.y + 4)
    this.y += 8.5
  }

  /** A smaller heading for a labeled block within a larger section (e.g. one show's "At a glance"). */
  subHeading(text: string) {
    this.ensure(7)
    const { doc } = this
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(COLORS.accent)
    doc.text(text.toUpperCase(), MARGIN.left, this.y + 3)
    this.y += 6.5
  }

  /**
   * A major heading for one whole show — bigger than sectionHeading, with
   * an optional right-aligned figure and an accent-colored rule underneath
   * so each show reads as its own distinct block in a multi-show report.
   */
  showHeading(title: string, rightText?: string) {
    this.ensure(14)
    const { doc } = this
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13.5)
    doc.setTextColor(COLORS.ink)
    doc.text(title, MARGIN.left, this.y + 5)
    if (rightText) {
      const w = doc.getTextWidth(rightText)
      doc.setTextColor(COLORS.accentDark)
      doc.text(rightText, PAGE_W - MARGIN.right - w, this.y + 5)
    }
    this.y += 7.5
    doc.setDrawColor(COLORS.accent)
    doc.setLineWidth(0.6)
    doc.line(MARGIN.left, this.y, PAGE_W - MARGIN.right, this.y)
    this.y += 5
  }

  paragraph(text: string, opts: { size?: number; color?: string; gap?: number } = {}) {
    const { doc } = this
    const size = opts.size ?? 9.5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(size)
    doc.setTextColor(opts.color ?? COLORS.sub)
    const lines: string[] = doc.splitTextToSize(text, CONTENT_W)
    const lineHeight = size * 0.42
    this.ensure(lines.length * lineHeight + (opts.gap ?? 4))
    for (const line of lines) {
      doc.text(line, MARGIN.left, this.y)
      this.y += lineHeight
    }
    this.y += opts.gap ?? 4
  }

  /** A light divider with a bit of breathing room on both sides. */
  divider(gapBefore = 2, gapAfter = 3) {
    this.ensure(gapBefore + gapAfter + 1)
    this.y += gapBefore
    this.doc.setDrawColor(COLORS.border)
    this.doc.setLineWidth(0.25)
    this.doc.line(MARGIN.left, this.y, PAGE_W - MARGIN.right, this.y)
    this.y += gapAfter
  }

  /** One label/value line — used for compact summary rows. `valueColor` defaults to ink. */
  keyValueRow(label: string, value: string, opts: { bold?: boolean; valueColor?: string; size?: number } = {}) {
    const { doc } = this
    const size = opts.size ?? 9.5
    this.ensure(size * 0.5)
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    doc.setTextColor(COLORS.sub)
    doc.text(label, MARGIN.left, this.y)
    doc.setTextColor(opts.valueColor ?? COLORS.ink)
    const vw = doc.getTextWidth(value)
    doc.text(value, PAGE_W - MARGIN.right - vw, this.y)
    this.y += size * 0.55
  }

  /**
   * A bordered card: a title, then a stack of label/value lines (indentable),
   * then an optional bold total line. Height is measured up front so the
   * whole card is pushed to a new page together rather than split across two.
   */
  card(input: {
    title: string
    titleRight?: string
    lines: { label: string; value: string; valueColor?: string; indent?: boolean; muted?: boolean; bold?: boolean }[]
    total?: { label: string; value: string; valueColor?: string }
    notes?: string[]
  }) {
    const { doc } = this
    const padX = 4.5
    const padY = 4
    const lineH = 4.6
    const titleH = 6
    const notesH = (input.notes?.length ?? 0) * 4
    const totalH = input.total ? lineH + 1.5 : 0
    const bodyH = input.lines.length * lineH
    const cardH = padY * 2 + titleH + bodyH + totalH + notesH + (input.total ? 1.5 : 0)

    this.ensure(cardH + 4)
    const top = this.y
    doc.setDrawColor(COLORS.border)
    doc.setFillColor('#ffffff')
    doc.setLineWidth(0.3)
    doc.roundedRect(MARGIN.left, top, CONTENT_W, cardH, 2, 2, 'FD')

    let cy = top + padY + 3.5
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(COLORS.ink)
    doc.text(input.title, MARGIN.left + padX, cy)
    if (input.titleRight) {
      doc.setFontSize(10.5)
      const w = doc.getTextWidth(input.titleRight)
      doc.text(input.titleRight, PAGE_W - MARGIN.right - padX - w, cy)
    }
    cy += titleH

    for (const line of input.lines) {
      const x = MARGIN.left + padX + (line.indent ? 3 : 0)
      doc.setFont('helvetica', line.bold ? 'bold' : 'normal')
      doc.setFontSize(line.bold ? 8.5 : 9)
      doc.setTextColor(line.bold ? COLORS.accent : line.muted ? COLORS.faint : COLORS.sub)
      doc.text(line.label, x, cy)
      doc.setTextColor(line.valueColor ?? (line.muted ? COLORS.faint : COLORS.ink))
      const vw = doc.getTextWidth(line.value)
      doc.text(line.value, PAGE_W - MARGIN.right - padX - vw, cy)
      cy += lineH
    }

    if (input.total) {
      doc.setDrawColor(COLORS.border)
      doc.setLineWidth(0.25)
      doc.line(MARGIN.left + padX, cy - lineH + 2.2, PAGE_W - MARGIN.right - padX, cy - lineH + 2.2)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      doc.setTextColor(COLORS.sub)
      doc.text(input.total.label, MARGIN.left + padX, cy + 1)
      doc.setTextColor(input.total.valueColor ?? COLORS.ink)
      const vw = doc.getTextWidth(input.total.value)
      doc.text(input.total.value, PAGE_W - MARGIN.right - padX - vw, cy + 1)
      cy += lineH
    }

    if (input.notes?.length) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8)
      doc.setTextColor(COLORS.faint)
      for (const note of input.notes) {
        doc.text(note, MARGIN.left + padX, cy)
        cy += 4
      }
    }

    this.y = top + cardH + 4
  }

  /** Stamps the footer (rule + note + "Page X of Y") on every page. Call once, last. */
  finalize() {
    const total = this.doc.getNumberOfPages()
    for (let i = 1; i <= total; i++) {
      this.doc.setPage(i)
      const ruleY = PAGE_H - MARGIN.bottom + 6
      this.doc.setDrawColor(COLORS.border)
      this.doc.setLineWidth(0.3)
      this.doc.line(MARGIN.left, ruleY, PAGE_W - MARGIN.right, ruleY)
      this.doc.setFont('helvetica', 'normal')
      this.doc.setFontSize(8)
      this.doc.setTextColor(COLORS.faint)
      this.doc.text(this.opts.footerNote, MARGIN.left, ruleY + 5)
      const label = `Page ${i} of ${total}`
      const w = this.doc.getTextWidth(label)
      this.doc.text(label, PAGE_W - MARGIN.right - w, ruleY + 5)
    }
  }

  save(filename: string) {
    this.finalize()
    this.doc.save(filename)
  }
}

/** Shared autoTable styling so every table in every report matches. */
export const TABLE_THEME = {
  margin: { left: MARGIN.left, right: MARGIN.right, top: MARGIN.top, bottom: MARGIN.bottom },
  styles: {
    font: 'helvetica',
    fontSize: 9,
    textColor: COLORS.ink,
    lineColor: COLORS.border,
    lineWidth: 0.2,
    cellPadding: { top: 2.2, bottom: 2.2, left: 3, right: 3 },
  },
  headStyles: {
    fillColor: COLORS.headBandFill,
    textColor: COLORS.accentDark,
    fontStyle: 'bold' as const,
    lineWidth: { bottom: 0.4 },
  },
  alternateRowStyles: { fillColor: '#fbf8ee' },
} as const
