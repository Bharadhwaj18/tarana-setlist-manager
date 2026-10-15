import autoTable from 'jspdf-autotable'
import { PdfDoc, TABLE_THEME, COLORS, MARGIN, CONTENT_W } from './pdfDoc'
import { todayISO, IST_TIME_ZONE } from '@/lib/shows'
import { APP_NAME, APP_SLUG } from '@/lib/brand'
import { formatMoneyPdf } from '@/lib/finance/settings'

/** How a workspace names and formats its money in reports. Missing values keep the old defaults. */
export interface ReportMoney { currency?: string; fundName?: string; ruleText?: string }

function applyReportMoney(m?: ReportMoney) {
  currency = m?.currency ?? 'INR'
  fund = m?.fundName ?? 'Band Fund'
}

// jsPDF's built-in Helvetica only covers the Windows-1252 repertoire — the
// Rupee sign (₹), the true minus sign (−), and arrows (→/←) all fall
// outside it and render as garbage glyphs. Stick to "Rs." and a plain
// ASCII hyphen everywhere text is drawn into the PDF.
// Set at the start of each report. Building a PDF is synchronous, so one report never sees another's.
let currency = 'INR'
let fund = 'Band Fund'

function fmt(n: number) {
  return formatMoneyPdf(n, currency)
}
function signed(n: number) {
  return `${n >= 0 ? '+' : '-'} ${fmt(n)}`
}
function today() {
  return new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: IST_TIME_ZONE })
}

export interface StatementRow { date: string; member: string; description: string; amount: number }

/** The Finance page's "Export" — a plain, clean statement table. */
export function buildTransactionStatementPdf(rows: StatementRow[], rangeLabel: string, memberLabel: string, money?: ReportMoney) {
  applyReportMoney(money)
  const total = rows.reduce((s, r) => s + r.amount, 0)

  const pdf = new PdfDoc({
    title: `${APP_NAME} Finance Statement`,
    subtitleLines: [`${rangeLabel} · ${memberLabel}`, `Generated ${today()}`],
    footerNote: `${APP_NAME} Finance Statement`,
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

  pdf.save(`${APP_SLUG}-finance-${todayISO()}.pdf`)
}

// ---- Split report -----------------------------------------------------

export interface SplitReportLine {
  showTitle: string
  entitlement: number
  cashPosition: number
  /** A category:'reimbursement' expense (fuel, etc.) for this show, always paid back in full on top of the cut. */
  guaranteedReimbursed: number
  isBandFundHolder: boolean
  bandFundAmount: number
  owedFromShow: number
}

export interface SplitReportRow {
  name: string
  lines: SplitReportLine[]
  owed: number
  /** Made whole once, batch-wide, if fronting money anywhere in this split left their real balance negative — not attributable to any one show, so it's its own column rather than folded into a show's line. */
  balanceTopUp: number
  selfPaid: number
  outgoing: { to: string; amount: number }[]
  incoming: { from: string; amount: number }[]
  newFundBalance: number
}

export interface SplitReportShow {
  showTitle: string
  net: number
  transactions: { description: string; memberName: string | null; amount: number }[]
  /** `reimbursement` is the guaranteed (fuel etc.) portion paid on top of `cut`, funded from this show's Band Fund cut rather than the shared pool. */
  cuts: { name: string; cut: number; reimbursement: number }[]
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
  allBalances: BandFundBalance[],
  money?: ReportMoney
) {
  applyReportMoney(money)
  const rule = money?.ruleText ?? `${bandPct}% to the ${fund}, then the rest equally among everyone who played`
  const zero = fmt(0)
  const pdf = new PdfDoc({
    title: `${APP_NAME} Split Report`,
    subtitleLines: [showTitles.join(', '), `${fund} ${bandPct}% · Generated ${today()}`],
    footerNote: `${APP_NAME} Split Report`,
  })

  pdf.paragraph(
    `This report covers ${shows.length} show${shows.length === 1 ? '' : 's'}. Each show's money is split: ${rule}. ` +
    `A guaranteed expense (fuel, parking — ` +
    `logged as a reimbursement) is always paid back in full, on top of the cut, for that show. Anyone else who ` +
    `spent their own money on a show is made whole separately: if fronting it anywhere in this split still leaves ` +
    `their real ${fund} balance below ${zero} once every show here is netted together, they're topped up back to ` +
    `exactly ${zero} — shown as its own "Balance Top-up" column below, since it isn't any one show's expense to ` +
    `attribute. Every payment (including someone covering their own share from their own ${fund}) is a ` +
    `straightforward payer-to-recipient debit — nobody is ever credited: money paid out becomes personal the ` +
    `moment it's paid. Each show below is broken down on its own; the overall settlement and everyone's combined ` +
    `${fund} appear at the end.`,
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
    const whoRows: string[][] = s.cuts.map(c => [
      c.reimbursement > 0.01 ? `${c.name} (incl. ${fmt(c.reimbursement)} reimbursement)` : c.name,
      fmt(c.cut + c.reimbursement),
    ])
    whoRows.push([`${fund} (${bandPct}%) — kept by ${s.bandFundHolderName}`, fmt(s.bandFundAmount)])
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
        line.guaranteedReimbursed > 0 ? fmt(line.guaranteedReimbursed) : '—',
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
      if (line.guaranteedReimbursed > 0.01) {
        lines.push({ label: `${r.name}'s reimbursement (fuel etc. — paid back in full)`, value: `+ ${fmt(line.guaranteedReimbursed)}`, indent: true, valueColor: COLORS.accentDark })
      }
      if (line.cashPosition < 0) {
        lines.push({ label: `${r.name} paid out of pocket for the show`, value: `- ${fmt(line.cashPosition)}`, indent: true, muted: true })
      }
      if (line.cashPosition > 0) {
        lines.push({ label: `${r.name} collected cash for the show — goes back`, value: `- ${fmt(line.cashPosition)}`, indent: true, valueColor: COLORS.negative })
      }
      if (line.isBandFundHolder) {
        lines.push({ label: `${r.name} is holding this show’s ${fund} share`, value: `+ ${fmt(line.bandFundAmount)}`, indent: true, valueColor: COLORS.accentDark })
      }
      pdf.card({
        title: r.name,
        lines,
        total: { label: 'Owed from this show', value: fmt(line.owedFromShow), valueColor: COLORS.positive },
      })
    }

    pdf.divider(2, 4)
    pdf.keyValueRow('Total from this show', signed(s.net), { bold: true, size: 10 })
    pdf.keyValueRow(fund, fmt(s.bandFundAmount), { valueColor: COLORS.accentDark })
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
      if (r.selfPaid > 0) settleRows.push([r.name, `${r.name} (self, from ${fund})`, fmt(r.selfPaid)])
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
    head: [['Member', ...shows.map(s => s.showTitle), 'Balance Top-up', 'Total']],
    body: rows.map(r => [
      r.name,
      ...shows.map(s => {
        const line = r.lines.find(l => l.showTitle === s.showTitle)
        return line ? fmt(line.owedFromShow) : '—'
      }),
      r.balanceTopUp > 0.01 ? fmt(r.balanceTopUp) : '—',
      fmt(r.owed),
    ]),
    columnStyles: { 0: { cellWidth: 'auto' } },
    didParseCell: data => {
      if (data.section === 'body' && data.column.index > 0) data.cell.styles.halign = 'right'
      if (data.section === 'body' && data.column.index === shows.length + 2) {
        data.cell.styles.textColor = COLORS.accentDark
        data.cell.styles.fontStyle = 'bold'
      }
    },
    didDrawPage: pdf.onAutoTablePageDrawn,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdf.syncAfterAutoTable((pdf.doc as any).lastAutoTable.finalY + 8)

  pdf.subHeading(`${fund} balances — everyone`)
  pdf.paragraph(`Every member's ${fund} after this split, whether or not they played these shows.`, { size: 8.5, gap: 3 })
  autoTable(pdf.doc, {
    ...TABLE_THEME,
    startY: pdf.y,
    head: [['Member', fund]],
    body: allBalances.map(b => [b.name, b.balance < 0 ? `- ${fmt(b.balance)}` : fmt(b.balance)]),
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 'wrap', halign: 'right' },
    },
    didParseCell: data => {
      if (data.section === 'body' && data.column.index === 1) {
        data.cell.styles.textColor = allBalances[data.row.index]?.balance < 0 ? COLORS.negative : COLORS.accentDark
        data.cell.styles.fontStyle = 'bold'
      }
    },
    didDrawPage: pdf.onAutoTablePageDrawn,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdf.syncAfterAutoTable((pdf.doc as any).lastAutoTable.finalY + 8)

  pdf.divider(2, 5)
  pdf.keyValueRow('Total from these shows', signed(totalNet), { bold: true, size: 10.5 })
  pdf.keyValueRow(fund, fmt(totalBandFund), { valueColor: COLORS.accentDark })
  pdf.keyValueRow('To artists', fmt(totalNet - totalBandFund))

  pdf.save(`${APP_SLUG}-split-${todayISO()}.pdf`)
}

// ---- Grouped report (Finance → Reports) ---------------------------------

export interface GroupedReportRow { label: string; moneyIn: number; moneyOut: number; net: number }

/** Money in, out and net per group (category, tag, project...) for a period. */
export function buildGroupedReportPdf(input: {
  periodLabel: string
  groupLabel: string
  rows: GroupedReportRow[]
  totals: { moneyIn: number; moneyOut: number; net: number; payouts: number }
  note?: string
  money?: ReportMoney
}) {
  applyReportMoney(input.money)
  const pdf = new PdfDoc({
    title: `${APP_NAME} Money Report`,
    subtitleLines: [`${input.periodLabel} · by ${input.groupLabel.toLowerCase()}`, `Generated ${today()}`],
    footerNote: `${APP_NAME} Money Report`,
  })

  autoTable(pdf.doc, {
    ...TABLE_THEME,
    startY: pdf.y + 2,
    head: [[input.groupLabel, 'Money in', 'Money out', 'Net']],
    body: input.rows.map(r => [r.label, fmt(r.moneyIn), fmt(r.moneyOut), signed(r.net)]),
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 'wrap', halign: 'right' },
      2: { cellWidth: 'wrap', halign: 'right' },
      3: { cellWidth: 'wrap', halign: 'right' },
    },
    didParseCell: data => {
      if (data.section === 'body' && data.column.index === 3) {
        data.cell.styles.textColor = input.rows[data.row.index].net >= 0 ? COLORS.positive : COLORS.negative
        data.cell.styles.fontStyle = 'bold'
      }
    },
    didDrawPage: pdf.onAutoTablePageDrawn,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdf.syncAfterAutoTable((pdf.doc as any).lastAutoTable.finalY)

  pdf.divider(4, 5)
  pdf.keyValueRow('Money in', fmt(input.totals.moneyIn), { valueColor: COLORS.positive })
  pdf.keyValueRow('Money out', fmt(input.totals.moneyOut), { valueColor: COLORS.negative })
  pdf.keyValueRow('Net', signed(input.totals.net), { bold: true, size: 10.5, valueColor: input.totals.net >= 0 ? COLORS.positive : COLORS.negative })
  if (input.totals.payouts > 0) {
    pdf.keyValueRow('Paid out to members (splits)', fmt(input.totals.payouts))
  }
  if (input.note) pdf.paragraph(input.note, { size: 8, gap: 2 })

  pdf.save(`${APP_SLUG}-report-${todayISO()}.pdf`)
}
