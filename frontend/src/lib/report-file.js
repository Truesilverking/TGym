import { jsPDF } from 'jspdf'
import { MOBILE, shareBase64, shareReportFiles } from './mobile.js'

export async function rasterizeReport({ svg, width, height }, mime = 'image/png') {
  if (![width, height].every(value => Number.isFinite(value) && value > 0)) throw new Error('Invalid report dimensions')
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  let canvas
  try {
    const image = new Image()
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url })
    canvas = document.createElement('canvas')
    // Long share images must remain within mobile canvas area/edge limits.
    // Ordinary PDF pages keep 2x quality; larger images retain their proportions.
    const scale = Math.min(2, Math.sqrt(12_000_000 / (width * height)), 16384 / Math.max(width, height))
    canvas.width = Math.max(1, Math.floor(width * scale)); canvas.height = Math.max(1, Math.floor(height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable')
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    const data = canvas.toDataURL(mime, 0.92)
    if (!data.startsWith('data:image/') || !data.split(',')[1]) throw new Error('Report image encoding failed')
    return data
  } finally { if (canvas) { canvas.width=0; canvas.height=0 }; URL.revokeObjectURL(url) }
}

// Common file infrastructure only: callers supply their own report pages.
export async function reportPagesFile(pages, name, { format = 'pdf', imageType = 'PNG', fullPage = false, title } = {}) {
  if (!pages.length) throw new Error('Empty report')
  if (format === 'png') {
    if (pages.length !== 1) throw new Error('PNG requires one page')
    return { name, blob: await (await fetch(await rasterizeReport(pages[0]))).blob() }
  }
  if (format !== 'pdf') throw new Error('Invalid report format')
  if (pages.some(page => page.orientation != null && !['portrait', 'landscape'].includes(page.orientation))) throw new Error('Invalid report orientation')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', ...(pages[0].orientation ? { orientation: pages[0].orientation } : {}) })
  if (title) pdf.setProperties({ title, creator: 'TGym' })
  for (const [i, page] of pages.entries()) {
    const orientation = page.orientation || 'portrait', previous = pages[i - 1]?.orientation || 'portrait'
    if (i) { if (orientation === 'portrait' && previous === 'portrait') pdf.addPage(); else pdf.addPage('a4', orientation) }
    const pageImageType = page.imageType ?? imageType, pageFull = page.fullPage ?? fullPage
    const data = await rasterizeReport(page, pageImageType === 'JPEG' ? 'image/jpeg' : 'image/png')
    const pageWidth = orientation === 'landscape' ? 297 : 210, pageHeight = orientation === 'landscape' ? 210 : 297
    const scale = Math.min((pageWidth - (pageFull ? 0 : 20)) / page.width, (pageHeight - (pageFull ? 0 : 20)) / page.height)
    pdf.addImage(data, pageImageType, (pageWidth - page.width * scale) / 2, pageFull ? 0 : 10, page.width * scale, page.height * scale, undefined, pageImageType === 'PNG' ? 'FAST' : undefined)
  }
  return { name, blob: pdf.output('blob') }
}

export async function saveReportFile({ blob, name, url }, { share = false } = {}) {
  if (MOBILE) {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result.split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    await shareBase64(base64, name)
  } else {
    const file = new File([blob], name, { type: blob.type })
    if (share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] })
      return
    }
    const href = url || URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = href; anchor.download = name
    document.body.appendChild(anchor)
    try { anchor.click() } finally {
      anchor.remove()
      if (!url) setTimeout(() => URL.revokeObjectURL(href), 1000)
    }
  }
}

export async function saveReportBatch(files) {
  if (!MOBILE) {
    for (const file of files) await saveReportFile(file)
    return
  }
  const encoded=[]
  for (const {blob,name} of files) {
    const base64=await new Promise((resolve,reject)=>{
      const reader=new FileReader()
      reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob)
    })
    encoded.push({name,base64})
  }
  await shareReportFiles(encoded)
}
