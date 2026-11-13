import autoTable from 'jspdf-autotable'
import { PdfDoc, TABLE_THEME, COLORS } from './pdfDoc'
import { todayISO, IST_TIME_ZONE } from '@/lib/shows'
import { APP_NAME, APP_SLUG } from '@/lib/brand'
import { formatMoneyPdf } from '@/lib/finance/settings'
import type { MerchReport, ReportRow } from '@/lib/merch-report'

// jsPDF's Helvetica can't draw ₹ or the true minus sign, so money goes through formatMoneyPdf ("Rs.") and
// negatives use a plain hyphen.

/** The Merch report as a PDF: per show, per item, and totals for the period. */
export function buildMerchReportPdf(report: MerchReport, periodLabel: string, currency = 'INR') {
  const fmt = (n: number) => `${n < 0 ? '-' : ''}${formatMoneyPdf(n, currency)}`
  const date = (d: string | null | undefined) =>
    d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: IST_TIME_ZONE }) : ''
  const generated = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: IST_TIME_ZONE })

  const pdf = new PdfDoc({
    title: `${APP_NAME} Merch Report`,
    subtitleLines: [periodLabel, `Generated ${generated}`],
    footerNote: `${APP_NAME} Merch Report`,
  })

  const profitCell = (rows: ReportRow[], col: number) => ({
    didParseCell: (data: { section: string; column: { index: number }; row: { index: number }; cell: { styles: { textColor?: unknown; fontStyle?: string } } }) => {
      if (data.section === 'body' && data.column.index === col) {
        data.cell.styles.textColor = rows[data.row.index].profit >= 0 ? COLORS.positive : COLORS.negative
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })
  const right = { halign: 'right' as const, cellWidth: 'wrap' as const }

  pdf.sectionHeading('By show')
  if (report.byShow.length) {
    autoTable(pdf.doc, {
      ...TABLE_THEME,
      startY: pdf.y + 2,
      head: [['Show', 'Sold', 'Taken', 'Cost', 'Given / lost', 'Profit']],
      body: report.byShow.map(r => [
        `${r.label}${r.date ? `\n${date(r.date)}` : ''}${r.pending ? `\n${fmt(r.pending)} waiting for approval` : ''}`,
        String(r.sold), fmt(r.taken), fmt(r.cost) + (r.costMissing ? '*' : ''), r.given + r.lost ? `${r.given + r.lost} (${fmt(r.writeOff)})` : '-', fmt(r.profit),
      ]),
      columnStyles: { 0: { cellWidth: 'auto' }, 1: right, 2: right, 3: right, 4: right, 5: right },
      ...profitCell(report.byShow, 5),
      didDrawPage: pdf.onAutoTablePageDrawn,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdf.syncAfterAutoTable((pdf.doc as any).lastAutoTable.finalY)
  } else {
    pdf.paragraph('Nothing sold in this period.', { size: 9 })
  }

  pdf.sectionHeading('By item')
  if (report.byItem.length) {
    autoTable(pdf.doc, {
      ...TABLE_THEME,
      startY: pdf.y + 2,
      head: [['Item', 'Sold', 'At list price', 'Cost', 'Given / lost', 'Profit']],
      body: report.byItem.map(r => [
        r.label, String(r.sold), fmt(r.listValue), fmt(r.cost) + (r.costMissing ? '*' : ''), r.given + r.lost ? `${r.given + r.lost} (${fmt(r.writeOff)})` : '-', fmt(r.profit),
      ]),
      columnStyles: { 0: { cellWidth: 'auto' }, 1: right, 2: right, 3: right, 4: right, 5: right },
      ...profitCell(report.byItem, 5),
      didDrawPage: pdf.onAutoTablePageDrawn,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdf.syncAfterAutoTable((pdf.doc as any).lastAutoTable.finalY)
  }

  const t = report.totals
  pdf.divider(4, 5)
  pdf.keyValueRow('Units sold', String(t.sold))
  pdf.keyValueRow('Money taken', fmt(t.taken), { valueColor: COLORS.positive })
  if (t.listValue !== t.taken) pdf.keyValueRow('At list price', fmt(t.listValue))
  if (t.pending) pdf.keyValueRow('Of which waiting for approval', fmt(t.pending))
  pdf.keyValueRow('Cost of goods sold', fmt(t.cost), { valueColor: COLORS.negative })
  if (t.writeOff) pdf.keyValueRow(`Given away / missing (${t.given + t.lost})`, fmt(t.writeOff), { valueColor: COLORS.negative })
  pdf.keyValueRow('Profit', fmt(t.profit), { bold: true, size: 10.5, valueColor: t.profit >= 0 ? COLORS.positive : COLORS.negative })
  if (t.costMissing) pdf.paragraph('* Some items have no restock cost recorded, so their cost counts as zero and profit is overstated.', { size: 8, gap: 2 })

  pdf.save(`${APP_SLUG}-merch-report-${todayISO()}.pdf`)
}
