import { filteredHistory, historyCsv } from '../lib/history-export.js'
export { filteredHistory, historyCsv } from '../lib/history-export.js'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { WorkoutRow, workoutDetailSheet, activityHistorySheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import ModuleSwitch, { PROGRESS_VIEWS } from '../components/ModuleSwitch.jsx'
import { useEffect, useRef, useState } from 'react'
import { SearchField, Segmented } from '../components/ui.jsx'
import { saveReportFile } from '../lib/report-file.js'
import { loggedWorkouts } from '../lib/daily-plan.js'
import { reportFileName } from '../lib/report-presentation.js'

export default function History() {
  const S = useStore(s => s.S)
  const [q, setQ] = useState('')
  const [period, setPeriod] = useState('all')
  const [exportProgress, setExportProgress] = useState(null), [exporting, setExporting] = useState(false), [exportError, setExportError] = useState(false)
  const working = useRef(false), mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const exportHistory = async () => {
    if (working.current) return
    working.current = true; setExporting(true); setExportError(false); setExportProgress(0)
    try {
      // Give the initial state a frame before the short, synchronous CSV build.
      await new Promise(resolve => requestAnimationFrame(resolve))
      if (!mounted.current) return
      const blob = new Blob([historyCsv(S, { query: q, period })], { type: 'text/csv;charset=utf-8' })
      setExportProgress(100)
      await saveReportFile({ blob, name: reportFileName(t('Workout history'), 'csv') })
    } catch (error) {
      if (mounted.current && error?.name !== 'AbortError' && !/^Share cancel(?:led|ed)$/i.test(error?.message || '')) setExportError(true)
    } finally { working.current = false; if (mounted.current) setExporting(false) }
  }
  const history = loggedWorkouts(S)
  const workouts = filteredHistory(S, { query: q, period }).reverse()
  return <>
    <div className="hdr">
      <div style={{ flex: 1, minWidth: 0 }}><h1>{t('History')}</h1><div className="sub">{t('{0} workouts', history.length)}</div></div>
      <div className="row" style={{ gap: 4, flex: 'none' }}><button className="iconbtn" onClick={activityHistorySheet} aria-label={t('Activity — last 12 months')} title={t('Activity — last 12 months')}><Icon name="calendar" /></button><button className="iconbtn" onClick={exportHistory} disabled={exporting} aria-label={t('Export for Excel')} title={t('Export for Excel')}><Icon name="download" /></button></div></div>
    {exportProgress != null && <p className="small dim" role="status" aria-live="polite">{exportProgress}% · CSV</p>}
    {exportError && <p role="alert">{t('Could not export. Try again.')}</p>}
    <ModuleSwitch items={PROGRESS_VIEWS} current="/history" />
    <SearchField value={q} onChange={e => setQ(e.target.value)} onClear={() => setQ('')} placeholder={t('Search workouts or exercises…')} />
    <div style={{ height: 10 }} /><Segmented value={period} onChange={setPeriod} options={[{ value: '30', label: t('30 days') }, { value: '90', label: t('90 days') }, { value: 'all', label: t('All') }]} />
    <div style={{ height: 12 }} />
    {workouts.length ? <div className="list">{workouts.map(w => <WorkoutRow key={w.id} w={w} onClick={() => workoutDetailSheet(w)} />)}</div>
      : <div className="empty"><div className="ico"><Icon name="history" /></div>{t('No workouts yet.')}</div>}
  </>
}
