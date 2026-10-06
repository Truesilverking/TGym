import { jsPDF } from 'jspdf'
import { MOBILE, shareBase64, shareReportFiles } from './mobile.js'

export async function rasterizeReport({ svg, width, height }, mime = 'image/png') {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  let canvas
  try {
    const image = new Image()
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url })
    canvas = document.createElement('canvas')
    canvas.width = width * 2; canvas.height = height * 2
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable')
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL(mime, 0.92)
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
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  if (title) pdf.setProperties({ title, creator: 'TGym' })
  for (const [i, page] of pages.entries()) {
    if (i) pdf.addPage()
    const pageImageType = page.imageType ?? imageType, pageFull = page.fullPage ?? fullPage
    const data = await rasterizeReport(page, pageImageType === 'JPEG' ? 'image/jpeg' : 'image/png')
    const scale = Math.min((pageFull ? 210 : 190) / page.width, (pageFull ? 297 : 277) / page.height)
    pdf.addImage(data, pageImageType, (210 - page.width * scale) / 2, pageFull ? 0 : 10, page.width * scale, page.height * scale, undefined, pageImageType === 'PNG' ? 'FAST' : undefined)
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
