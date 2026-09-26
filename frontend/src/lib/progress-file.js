import { progressReportPages } from './progress-export.js'
import { MOBILE, shareBase64 } from './mobile.js'

// Build from the exact selected report, not a second all-time calculation.
export async function buildProgressFile(report, options = {}) {
  if (!report.summary || report.range.error) throw new Error('Invalid report period')
  const [{ jsPDF }, { rasterizeReport }] = await Promise.all([
    import('jspdf'), import('../components/CalendarExport.jsx'),
  ])
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  pdf.setProperties({ title: 'TGym Progress Report', creator: 'TGym' })
  for (const [i, page] of progressReportPages(null, { ...options, report }).entries()) {
    if (i) pdf.addPage()
    // Lossless charts/text also avoid JPEG decoder differences in PDF readers.
    const image = await rasterizeReport(page, 'image/png')
    pdf.addImage(image, 'PNG', 0, 0, 210, 291.9, undefined, 'FAST')
  }
  return { name: `TGym-Progress-Report-${report.range.start}_${report.range.end}.pdf`, blob: pdf.output('blob') }
}

export async function saveProgressFile({ blob, name, url }) {
  if (MOBILE) {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result.split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    await shareBase64(base64, name)
  } else {
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = name
    document.body.appendChild(anchor)
    try { anchor.click() } finally { anchor.remove() }
  }
}
