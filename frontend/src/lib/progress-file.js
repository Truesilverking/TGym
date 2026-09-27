import { loadBodyGeometry } from './body-geometry.js'
import { progressReportPages } from './progress-export.js'
import { MOBILE, shareBase64 } from './mobile.js'

// Build from the exact selected report, not a second all-time calculation.
export async function buildProgressFile(report, options = {}) {
  if (!report.summary || report.range.error) throw new Error('Invalid report period')
  const [{ jsPDF }, { rasterizeReport }, bodyGeometry] = await Promise.all([
    import('jspdf'), import('../components/CalendarExport.jsx'), loadBodyGeometry(),
  ])
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  pdf.setProperties({ title: 'TGym Progress Report', creator: 'TGym' })
  for (const [i, page] of progressReportPages(null, { ...options, report, bodyGeometry }).entries()) {
    if (i) pdf.addPage()
    // Lossless charts/text also avoid JPEG decoder differences in PDF readers.
    const image = await rasterizeReport(page, 'image/png')
    pdf.addImage(image, 'PNG', 0, 0, 210, 291.9, undefined, 'FAST')
  }
  const suffix=options.sections?.length===1?'-'+options.sections[0]:options.sections?.length&&options.sections.length<8?'-selected':''
  return { name: `TGym-Progress-Report-${report.range.start}_${report.range.end}${suffix}.pdf`, blob: pdf.output('blob') }
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
