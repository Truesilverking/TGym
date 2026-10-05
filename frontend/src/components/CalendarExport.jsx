import { useEffect, useRef, useState } from 'react'
import { reportPagesFile, saveReportFile } from '../lib/report-file.js'
import { calendarReportPages, reportFilename } from '../lib/calendar-report.js'
import { t } from '../lib/i18n.js'
import { MOBILE } from '../lib/mobile.js'
import { Button } from './ui.jsx'

export async function buildCalendarExport(S, anchor, period, format) {
  const pages = calendarReportPages(S, anchor, period, format, { t })
  return reportPagesFile(pages, reportFilename(anchor, period, format), { format, imageType: 'JPEG' })
}

export default function CalendarExport({ S, anchor, close }) {
  const [period, setPeriod] = useState('week'), [format, setFormat] = useState('png')
  const [busy, setBusy] = useState(false), [result, setResult] = useState(null), [error, setError] = useState('')
  const mounted = useRef(true), exporting = useRef(false), current = useRef({ S, anchor })
  current.current = { S, anchor }
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => { setResult(null); setError('') }, [S, anchor])
  useEffect(() => () => { if (result?.url) URL.revokeObjectURL(result.url) }, [result])
  const generate = async () => {
    if (exporting.current) return
    exporting.current = true
    setBusy(true); setError('')
    try {
      const file = await buildCalendarExport(S, anchor, period, period === 'full' ? 'pdf' : format)
      if (mounted.current && current.current.S === S && current.current.anchor === anchor) setResult({ ...file, url: URL.createObjectURL(file.blob) })
    }
    catch { if (mounted.current) setError(t('Export failed. Please try again.')) }
    finally { exporting.current = false; if (mounted.current) setBusy(false) }
  }
  const share = async () => {
    if (exporting.current) return
    exporting.current = true; setBusy(true); setError('')
    try {
      await saveReportFile(result, { share: true })
    } catch (e) { if (mounted.current && e?.name !== 'AbortError' && e?.message !== 'Share canceled') setError(t('Export failed. Please try again.')) }
    finally { exporting.current = false; if (mounted.current) setBusy(false) }
  }
  return <><h3>{t('Export Calendar')}</h3>
    {!result ? <><label>{t('Period')}<select className="input" disabled={busy} value={period} onChange={e => setPeriod(e.target.value)}>{[['week','Week'],['month','Month'],['year','Year'],['full','Full report']].map(([v,l]) => <option key={v} value={v}>{t(l)}</option>)}</select></label>
      <label>{t('Format')}<select className="input" disabled={busy || period === 'full'} value={period === 'full' ? 'pdf' : format} onChange={e => setFormat(e.target.value)}><option value="png">PNG</option><option value="pdf">PDF</option></select></label>
      <Button disabled={busy} onClick={generate}>{t(busy ? 'Working…' : 'Export')}</Button></> : <><p>{result.name}</p><Button disabled={busy} onClick={share}>{t('Share / save')}</Button>{!MOBILE && <a href={result.url} target="_blank" rel="noopener noreferrer">{t('Open')}</a>}<Button onClick={close}>{t('Done')}</Button></>}
    {error && <p role="alert">{error}</p>}
  </>
}
