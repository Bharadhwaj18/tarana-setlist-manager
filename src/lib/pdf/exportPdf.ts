export async function exportElementToPdf(element: HTMLElement, filename: string) {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  })

  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const imgWidth = pageWidth - 20  // 10mm margins each side
  const imgHeight = (canvas.height * imgWidth) / canvas.width

  let yOffset = 10
  let remainingHeight = imgHeight

  // If content is taller than one page, paginate
  while (remainingHeight > 0) {
    pdf.addImage(imgData, 'PNG', 10, yOffset, imgWidth, imgHeight)
    remainingHeight -= (pageHeight - 20)
    if (remainingHeight > 0) {
      pdf.addPage()
      yOffset = 10 - (imgHeight - remainingHeight)
    }
  }

  pdf.save(filename)
}
