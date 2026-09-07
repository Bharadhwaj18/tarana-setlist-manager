import autoTable from 'jspdf-autotable'
import { PdfDoc, TABLE_THEME, COLORS, MARGIN, CONTENT_W } from './pdfDoc'

// jsPDF's built-in Helvetica only covers the Windows-1252 repertoire — the
// Rupee sign (₹), the true minus sign (−), and arrows (→/←) all fall
// outside it and render as garbage glyphs. Stick to "Rs." and a plain
// ASCII hyphen everywhere text is drawn into the PDF.
function fmt(n: number) {
  return `Rs. ${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}
function signed(n: number) {
  return `${n >= 0 ? '+' : '-'} ${fmt(n)}`
}
function today() {
  return new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

export interface StatementRow { date: string; member: string; description: string; amount: number }

/** The Finance page's "Export" — a plain, clean statement table. */
export function buildTransactionStatementPdf(rows: StatementRow[], rangeLabel: string, memberLabel: string) {
  const total = rows.reduce((s, r) => s + r.amount, 0)

  const pdf = new PdfDoc({
    title: 'Tarana Finance Statement',
    subtitleLines: [`${rangeLabel} · ${memberLabel}`, `Generated ${today()}`],
    footerNote: 'Tarana Finance Statement',
  })

  autoTable(pdf.doc, {
    ...TABLE_THEME,
    startY: pdf.y + 2,
    head: [['Date', 'Member', 'Description', 'Amount']],
    body: rows.map(r => [r.date, r.member, r.description, signed(r.amount)]),
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 30 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 'wrap', halign: 'right' },
    },
    didParseCell: data => {
      if (data.section === 'body' && data.column.index === 3) {
        const amount = rows[data.row.index].amount
        data.cell.styles.textColor = amount >= 0 ? COLORS.positive : COLORS.negative
        data.cell.styles.fontStyle = 'bold'
      }
    },
    didDrawPage: pdf.onAutoTablePageDrawn,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdf.syncAfterAutoTable((pdf.doc as any).lastAutoTable.finalY)

  pdf.divider(4, 5)
  pdf.keyValueRow(`Total (${rows.length} transaction${rows.length === 1 ? '' : 's'})`, signed(total), {
    bold: true,
    size: 10.5,
    valueColor: total >= 0 ? COLORS.positive : COLORS.negative,
  })

  pdf.save(`tarana-finance-${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ---- Split report -----------------------------------------------------

export interface SplitReportLine {
  showTitle: string
  entitlement: number
  cashPosition: number
  reimbursed: number
  isBandFundHolder: boolean
  bandFundAmount: number
  owedFromShow: number
}

export interface SplitReportRow {
  name: string
  lines: SplitReportLine[]
  owed: number
  selfPaid: number
  outgoing: { to: string; amount: number }[]
  incoming: { from: string; amount: number }[]
  newFundBalance: number
}

export interface SplitReportShow {
  showTitle: string
  net: number
  transactions: { description: string; memberName: string | null; amount: number }[]
  cuts: { name: string; cut: number }[]
  bandFundHolderName: string
  bandFundAmount: number
}

export interface BandFundBalance { name: string; balance: number }

export function buildSplitReportPdf(
  showTitles: string[],
  bandPct: number,
  shows: SplitReportShow[],
  rows: SplitReportRow[],
  totalNet: number,
  totalBandFund: number,
  allBalances: BandFundBalance[]
) {
  const pdf = new PdfDoc({
    title: 'Tarana Split Report',
    subtitleLines: [showTitles.join(', '), `Band Fund ${bandPct}% · Generated ${today()}`],
    footerNote: 'Tarana Split Report',
  })

  pdf.paragraph(
    `This report covers ${shows.length} show${shows.length === 1 ? '' : 's'}. Each show's money is split ${bandPct}% ` +
    `to the Band Fund and the rest equally among everyone who played it. Anyone who spent their own money on a show ` +
    `gets it back — but only the part that would've taken their own balance below Rs. 0; if their existing balance ` +
    `already covers it, no cash needs to move for that part. Every payment (including someone covering their own ` +
    `share from their own Band Fund) is a straightforward payer-to-recipient debit — nobody is ever credited: money ` +
    `paid out becomes personal the moment it's paid. Each show below is broken down on its own; the overall ` +
    `settlement and everyone's combined Band Fund appear at the end.`,
    { gap: 6 }
  )

  // ---- One full section per show -------------------------------------
  for (const s of shows) {
    pdf.showHeading(s.showTitle, fmt(s.net))

    if (s.transactions.length > 0) {
      pdf.subHeading('Cost breakdown')
      const { doc } = pdf
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      for (const t of s.transactions) {
        pdf.ensure(4)
        const label = `${t.description}${t.memberName ? ` (${t.memberName})` : ''}`
        doc.setTextColor(COLORS.sub)
        doc.text(label, MARGIN.left + 2, pdf.y)
        doc.setTextColor(t.amount >= 0 ? COLORS.positive : COLORS.negative)
        const vw = doc.getTextWidth(signed(t.amount))
        doc.text(signed(t.amount), MARGIN.left + CONTENT_W - vw, pdf.y)
        pdf.y += 4
      }
      pdf.y += 3
    }

    pdf.subHeading('Who\'s getting what')
    const whoRows: string[][] = s.cuts.map(c => [c.name, fmt(c.cut)])
    whoRows.push([`Band Fund (${bandPct}%) — kept by ${s.bandFundHolderName}`, fmt(s.bandFundAmount)])
    autoTable(pdf.doc, {
      ...TABLE_THEME,
      startY: pdf.y,
      head: [['Who', 'Amount']],
      body: whoRows,
      columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 'wrap', halign: 'right' } },
      didParseCell: data => {
        if (data.section === 'body' && data.row.index === whoRows.length - 1) {
          data.cell.styles.textColor = COLORS.accentDark
          data.cell.styles.fontStyle = 'bold'
        }
      },
      didDrawPage: pdf.onAutoTablePageDrawn,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdf.syncAfterAutoTable((pdf.doc as any).lastAutoTable.finalY + 8)

    // This show's own line for every person it involved.
    const showLines = rows
      .map(r => ({ r, line: r.lines.find(l => l.showTitle === s.showTitle) }))
      .filter((x): x is { r: SplitReportRow; line: SplitReportLine } => !!x.line)

    pdf.subHeading('At a glance')
    autoTable(pdf.doc, {
      ...TABLE_THEME,
      startY: pdf.y,
      head: [['Member', 'Cut', 'Reimbursed', 'Owed from this show']],
      body: showLines.map(({ r, line }) => [
        r.name,
        fmt(line.entitlement),
        line.reimbursed > 0 ? fmt(line.reimbursed) : '—',
        fmt(line.owedFromShow),
      ]),
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 'wrap', halign: 'right' },
        2: { cellWidth: 'wrap', halign: 'right' },
        3: { cellWidth: 'wrap', halign: 'right' },
      },
      didParseCell: data => {
        if (data.section === 'body' && data.column.index === 3) {
          data.cell.styles.textColor = COLORS.positive
          data.cell.styles.fontStyle = 'bold'
        }
      },
      didDrawPage: pdf.onAutoTablePageDrawn,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdf.syncAfterAutoTable((pdf.doc as any).lastAutoTable.finalY + 8)

    pdf.subHeading('Full breakdown, person by person')
    for (const { r, line } of showLines) {
      const lines: { label: string; value: string; valueColor?: string; indent?: boolean; muted?: boolean }[] = []
      lines.push({ label: `${r.name}'s cut`, value: `+ ${fmt(line.entitlement)}`, indent: true })
      if (line.cashPosition < 0) {
        lines.push({ label: `${r.name} paid out of pocket for the show`, value: `- ${fmt(line.cashPosition)}`, indent: true, muted: true })
        if (line.reimbursed > 0) {
          lines.push({ label: `Paid back (would’ve dropped ${r.name}'s balance below Rs. 0)`, value: `+ ${fmt(line.reimbursed)}`, indent: true, valueColor: COLORS.positive })
        }
      }
      if (line.cashPosition > 0) {
        lines.push({ label: `${r.name} collected cash for the show — goes back`, value: `- ${fmt(line.cashPosition)}`, indent: true, valueColor: COLORS.negative })
      }
      if (line.isBandFundHolder) {
        lines.push({ label: `${r.name} is holding this show’s Band Fund cut`, value: `+ ${fmt(line.bandFundAmount)}`, indent: true, valueColor: COLORS.accentDark })
      }
      pdf.card({
        title: r.name,
        lines,
        total: { label: 'Owed from this show', value: fmt(line.owedFromShow), valueColor: COLORS.positive },
      })
    }

    pdf.divider(2, 4)
    pdf.keyValueRow('Total from this show', signed(s.net), { bold: true, size: 10 })
    pdf.keyValueRow('Band Fund', fmt(s.bandFundAmount), { valueColor: COLORS.accentDark })
    pdf.keyValueRow('To artists', fmt(s.net - s.bandFundAmount))
    pdf.y += 5
  }

  // ---- Overall breakdown, across every show in this split -------------
  pdf.sectionHeading('Overall breakdown')

  const hasSettlement = rows.some(r => r.selfPaid > 0 || r.outgoing.length > 0)
  if (hasSettlement) {
    pdf.subHeading('Settlement — who pays whom')
    const settleRows: string[][] = []
    for (const r of rows) {
      if (r.selfPaid > 0) settleRows.push([r.name, `${r.name} (self, from Band Fund)`, fmt(r.selfPaid)])
      for (const p of r.outgoing) settleRows.push([r.name, p.to, fmt(p.amount)])
    }
    autoTable(pdf.doc, {
      ...TABLE_THEME,
      startY: pdf.y,
      head: [['Pays', 'To', 'Amount']],
      body: settleRows,
      columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 'wrap', halign: 'right' } },
      didDrawPage: pdf.onAutoTablePageDrawn,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdf.syncAfterAutoTable((pdf.doc as any).lastAutoTable.finalY + 8)
  }

  pdf.subHeading('Everyone\'s cut, show by show')
  autoTable(pdf.doc, {
    ...TABLE_THEME,
    startY: pdf.y,
    head: [['Member', ...shows.map(s => s.showTitle), 'Total']],
    body: rows.map(r => [
      r.name,
      ...shows.map(s => {
        const line = r.lines.find(l => l.showTitle === s.showTitle)
        return line ? fmt(line.owedFromShow) : '—'
      }),
      fmt(r.owed),
    ]),
    columnStyles: { 0: { cellWidth: 'auto' } },
    didParseCell: data => {
      if (data.section === 'body' && data.column.index > 0) data.cell.styles.halign = 'right'
      if (data.section === 'body' && data.column.index === shows.length + 1) {
        data.cell.styles.textColor = COLORS.accentDark
        data.cell.styles.fontStyle = 'bold'
      }
    },
    didDrawPage: pdf.onAutoTablePageDrawn,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdf.syncAfterAutoTable((pdf.doc as any).lastAutoTable.finalY + 8)

  pdf.subHeading('Band Fund balances — everyone')
  pdf.paragraph('Every band member\'s Band Fund after this split, whether or not they played these shows.', { size: 8.5, gap: 3 })
  autoTable(pdf.doc, {
    ...TABLE_THEME,
    startY: pdf.y,
    head: [['Member', 'Band Fund']],
    body: allBalances.map(b => [b.name, fmt(b.balance)]),
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 'wrap', halign: 'right' },
    },
    didParseCell: data => {
      if (data.section === 'body' && data.column.index === 1) {
        data.cell.styles.textColor = COLORS.accentDark
        data.cell.styles.fontStyle = 'bold'
      }
    },
    didDrawPage: pdf.onAutoTablePageDrawn,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdf.syncAfterAutoTable((pdf.doc as any).lastAutoTable.finalY + 8)

  pdf.divider(2, 5)
  pdf.keyValueRow('Total from these shows', signed(totalNet), { bold: true, size: 10.5 })
  pdf.keyValueRow('Band Fund', fmt(totalBandFund), { valueColor: COLORS.accentDark })
  pdf.keyValueRow('To artists', fmt(totalNet - totalBandFund))

  pdf.save(`tarana-split-${new Date().toISOString().slice(0, 10)}.pdf`)
}
