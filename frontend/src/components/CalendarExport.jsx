import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'
import { ZoomCalendar } from '../sheets.jsx'
import { calendarPeriod, calendarFilename } from '../lib/calendar-data.js'
import { t } from '../lib/i18n.js'
import { MOBILE, shareBase64 } from '../lib/mobile.js'
import { workoutElapsedMs } from '../lib/workout-time.js'
import { fmtDur } from '../lib/format.js'
import { trainingStreak } from '../lib/training-plan.js'
import { Button } from './ui.jsx'

async function capture(S, anchor, period, includeMeasurements = true) {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-20000px;top:0;width:900px;padding:28px;background:var(--bg);color:var(--label);pointer-events:none'
  host.className = 'calendar-export'
  host.setAttribute('aria-hidden', 'true')
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    flushSync(() => root.render(<><h2>TGym · {t('Training calendar')}</h2><ZoomCalendar S={S} initialAnchor={anchor} initialLevel={period === 'year' ? 'months' : period} exporting includeMeasurements={includeMeasurements} /></>))
    await document.fonts?.ready
    const png = await toPng(host, { pixelRatio: 2, backgroundColor: getComputedStyle(document.body).backgroundColor, skipFonts: true })
    return { png, width: host.offsetWidth, height: host.offsetHeight }
  } finally { root.unmount(); host.remove() }
}

export async function buildCalendarExport(S, anchor, period, format, { includeMeasurements = true } = {}) {
  const summary = calendarPeriod(S, anchor, period)
  const name = calendarFilename(period, summary.start, summary.end, format)
  if (format === 'png') {
    if (period === 'full') throw new Error('Full reports require PDF')
    const { png } = await capture(S, anchor, period, includeMeasurements)
    return { name, blob: await (await fetch(png)).blob() }
  }
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = 18
  const line = (value, size = 11) => {
    pdf.setFontSize(size)
    for (const row of pdf.splitTextToSize(String(value), 178)) {
      if (y > 276) { pdf.addPage(); y = 18 }
      pdf.text(row, 16, y); y += size * .48 + 2
    }
  }
  const page = () => { pdf.addPage(); y = 18 }
  const section = async (date, p) => {
    const data = calendarPeriod(S, date, p)
    line(`TGym · ${t('Training calendar')}`, 18)
    line(`${data.start} - ${data.end}`)
    const shot = await capture(S, date, p, includeMeasurements)
    const height = Math.min(190, shot.height / shot.width * 178)
    pdf.addImage(shot.png, 'PNG', 16, y, 178, height); y += height + 8
    line(`${t('Scheduled')}: ${data.counts.scheduled} · ${t('Completed')}: ${data.counts.completed}`)
    line(`${t('Not completed')}: ${data.counts.missed} · ${t('Pending')}: ${data.counts.pending} · ${data.completion}%`)
    if (p === 'year') {
      const streak = trainingStreak(S, new Date(Math.min(Date.now(), new Date(date.getFullYear(), 11, 31, 23, 59).getTime())))
      line(`${t('Best streak')}: ${streak.best}`)
      for (let m = 0; m < 12; m++) {
        const month = calendarPeriod(S, new Date(date.getFullYear(), m, 1), 'month')
        line(`${month.start.slice(0,7)}: ${month.counts.completed} ${t('Completed')} / ${month.counts.scheduled} ${t('Scheduled')} (${month.completion}%)`)
      }
    } else for (const day of data.days.filter(d => p === 'week' || d.status !== 'rest' || (includeMeasurements && d.measurements.length))) {
      const label = { completed: 'Completed', missed: 'Not completed', pending: 'Pending', rest: 'Rest day' }[day.status]
      line(`${day.iso} · ${t(label)}${day.name ? ' · ' + day.name : ''}`)
    }
  }
  await section(anchor, period === 'full' ? 'year' : period)
  if (includeMeasurements) { for (const day of summary.days.filter(d => d.measurements.length)) line(day.iso + ' · ' + day.measurements.map(r => t(r.label) + ' (' + t(r.status) + ')').join(', ')) }
  if (period === 'full') {
    for (let m = 0; m < 12; m++) { page(); await section(new Date(anchor.getFullYear(), m, 1), 'month') }
    page(); line(t('Workout history'), 18)
    for (const w of S.workouts.filter(w => w.d >= summary.start && w.d <= summary.end).sort((a,b) => a.d.localeCompare(b.d))) {
      line(`${w.d} · ${w.name || t('Workout')}`, 13)
      if (w.start && w.end) line(`${t('Duration')}: ${fmtDur(workoutElapsedMs(w))}`)
      if (Array.isArray(w.entries)) line(`${t('Exercises')}: ${w.entries.length}`)
    }
  }
  return { name, blob: pdf.output('blob') }
}

export default function CalendarExport({ S, anchor, close }) {
  const [includeMeasurements, setIncludeMeasurements] = useState(true)
  const [period, setPeriod] = useState('week'), [format, setFormat] = useState('png')
  const [busy, setBusy] = useState(false), [result, setResult] = useState(null), [error, setError] = useState('')
  useEffect(() => () => { if (result?.url) URL.revokeObjectURL(result.url) }, [result])
  const generate = async () => {
    setBusy(true); setError('')
    try { const file = await buildCalendarExport(S, anchor, period, period === 'full' ? 'pdf' : format, {includeMeasurements}); setResult({ ...file, url: URL.createObjectURL(file.blob) }) }
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
  return <><h3>{t('Export Calendar')}</h3><label className="row"><input type="checkbox" checked={includeMeasurements} disabled={busy || !!result} onChange={e => setIncludeMeasurements(e.target.checked)} />{t('Include measurement reminders')}</label>
    {!result ? <><label>{t('Period')}<select className="input" disabled={busy} value={period} onChange={e => setPeriod(e.target.value)}>{[['week','Week'],['month','Month'],['year','Year'],['full','Full report']].map(([v,l]) => <option key={v} value={v}>{t(l)}</option>)}</select></label>
      <label>{t('Format')}<select className="input" disabled={busy || period === 'full'} value={period === 'full' ? 'pdf' : format} onChange={e => setFormat(e.target.value)}><option value="png">PNG</option><option value="pdf">PDF</option></select></label>
      <Button disabled={busy} onClick={generate}>{t(busy ? 'Working…' : 'Export')}</Button></> : <><p>{result.name}</p><Button onClick={share}>{t('Share / save')}</Button>{!MOBILE && <a href={result.url} target="_blank" rel="noopener noreferrer">{t('Open')}</a>}<Button onClick={close}>{t('Done')}</Button></>}
    {error && <p role="alert">{error}</p>}
  </>
}
