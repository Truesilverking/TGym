import { useEffect, useMemo, useRef, useState } from 'react'
import { saveReportFile } from '../lib/report-file.js'
import { buildCalendarExport, buildConsistencyExport } from '../lib/calendar-file.js'
export { buildCalendarExport } from '../lib/calendar-file.js'
import { STREAK_PERIODS, buildStreakReport } from '../lib/streak-report.js'
import { isoOf } from '../lib/format.js'
import { useLocalNow } from '../lib/use-local-now.js'
import ReportDateRange from './ReportDateRange.jsx'
import './ReportsExport.css'
import { t } from '../lib/i18n.js'
import { MOBILE } from '../lib/mobile.js'
import { Button } from './ui.jsx'

export default function CalendarExport({ S, anchor, close, reportType = 'streak' }) {
  const consistency = reportType === 'consistency', now = useLocalNow(), today = isoOf(now)
  const [range, setRange] = useState({ period: consistency ? 'week' : 'this-week', from: isoOf(anchor), to: today }), [format, setFormat] = useState('png')
  const period = range.period
  const report = useMemo(()=>consistency ? null : buildStreakReport(S, { ...range, anchor, now }),[S,range,anchor,today,consistency])
  const pdfOnly = period === 'full' || !consistency && report?.days.length > 366
  const [busy, setBusy] = useState(false), [result, setResult] = useState(null), [error, setError] = useState('')
  const mounted = useRef(true), exporting = useRef(false), current = useRef({ S, anchor })
  current.current = { S, anchor, today }
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => { setResult(null); setError('') }, [S, anchor, today])
  useEffect(() => () => { if (result?.url) URL.revokeObjectURL(result.url) }, [result])
  const generate = async () => {
    if (exporting.current) return
    exporting.current = true
    setBusy(true); setError('')
    try {
      const build = consistency ? buildConsistencyExport : buildCalendarExport
      const file = await build(S, anchor, period, pdfOnly ? 'pdf' : format, { ...range, now, t })
      if (mounted.current && current.current.S === S && current.current.anchor === anchor && current.current.today === today) setResult({ ...file, url: URL.createObjectURL(file.blob) })
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
  return <><h3>{t(consistency ? 'Consistency Report' : 'Export Calendar')}</h3>
    {!result ? <><ReportDateRange value={range} onChange={setRange} periods={consistency ? [['week','Week'],['month','Month'],['year','Year'],['full','Full report']] : STREAK_PERIODS} disabled={busy} today={today}/>
      <label>{t('Format')}<select className="input" disabled={busy || pdfOnly} value={pdfOnly ? 'pdf' : format} onChange={e => setFormat(e.target.value)}><option value="png">PNG</option><option value="pdf">PDF</option></select></label>
      <Button disabled={busy || !!report?.range.error} onClick={generate}>{t(busy ? 'Working…' : 'Export')}</Button></> : <><p>{result.name}</p><Button disabled={busy} onClick={share}>{t('Share / save')}</Button>{!MOBILE && <a href={result.url} target="_blank" rel="noopener noreferrer">{t('Open')}</a>}<Button onClick={close}>{t('Done')}</Button></>}
    {report?.noData && !result && <p className="small dim">{t('No recorded activity in this period.')}</p>}
    {(error || report?.range.error) && <p role="alert">{error || t(report.range.error)}</p>}
  </>
}
