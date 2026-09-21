import { useEffect, useState } from 'react'
import { jsPDF } from 'jspdf'
import { calendarReportPages, reportFilename } from '../lib/calendar-report.js'
import { t } from '../lib/i18n.js'
import { MOBILE, shareBase64 } from '../lib/mobile.js'
import { Button } from './ui.jsx'

export async function rasterizeReport({ svg, width, height }) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const image = new Image()
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url })
    const canvas = document.createElement('canvas')
    canvas.width = width * 2; canvas.height = height * 2
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable')
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  } finally { URL.revokeObjectURL(url) }
}

export async function buildCalendarExport(S, anchor, period, format) {
  const pages = calendarReportPages(S, anchor, period, format, { t })
  const name = reportFilename(anchor, period, format)
  if (format === 'png') return { name, blob: await (await fetch(await rasterizeReport(pages[0]))).blob() }
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  for (const [i, page] of pages.entries()) {
    if (i) pdf.addPage()
    const png = await rasterizeReport(page)
    const scale = Math.min(190 / page.width, 277 / page.height)
    pdf.addImage(png, 'PNG', (210 - page.width * scale) / 2, 10, page.width * scale, page.height * scale)
  }
  return { name, blob: pdf.output('blob') }
}

export default function CalendarExport({ S, anchor, close }) {
  const [period, setPeriod] = useState('week'), [format, setFormat] = useState('png')
  const [busy, setBusy] = useState(false), [result, setResult] = useState(null), [error, setError] = useState('')
  useEffect(() => () => { if (result?.url) URL.revokeObjectURL(result.url) }, [result])
  const generate = async () => {
    setBusy(true); setError('')
    try { const file = await buildCalendarExport(S, anchor, period, period === 'full' ? 'pdf' : format); setResult({ ...file, url: URL.createObjectURL(file.blob) }) }
    catch { setError(t('Export failed. Please try again.')) }
    finally { setBusy(false) }
  }
  const share = async () => {
    try {
      if (MOBILE) {
        const base64 = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result.split(',')[1]); r.onerror = reject; r.readAsDataURL(result.blob) })
        await shareBase64(base64, result.name)
      } else {
        const file = new File([result.blob], result.name, { type: result.blob.type })
        if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] })
        else { const a = document.createElement('a'); a.href = result.url; a.download = result.name; a.click() }
      }
    } catch (e) { if (e.name !== 'AbortError') setError(t('Export failed. Please try again.')) }
  }
  return <><h3>{t('Export Calendar')}</h3>
    {!result ? <><label>{t('Period')}<select className="input" disabled={busy} value={period} onChange={e => setPeriod(e.target.value)}>{[['week','Week'],['month','Month'],['year','Year'],['full','Full report']].map(([v,l]) => <option key={v} value={v}>{t(l)}</option>)}</select></label>
      <label>{t('Format')}<select className="input" disabled={busy || period === 'full'} value={period === 'full' ? 'pdf' : format} onChange={e => setFormat(e.target.value)}><option value="png">PNG</option><option value="pdf">PDF</option></select></label>
      <Button disabled={busy} onClick={generate}>{t(busy ? 'Working…' : 'Export')}</Button></> : <><p>{result.name}</p><Button onClick={share}>{t('Share / save')}</Button>{!MOBILE && <a href={result.url} target="_blank" rel="noopener noreferrer">{t('Open')}</a>}<Button onClick={close}>{t('Done')}</Button></>}
    {error && <p role="alert">{error}</p>}
  </>
}
