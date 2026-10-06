import { filteredHistory, historyCsv } from '../lib/history-export.js'
export { filteredHistory, historyCsv } from '../lib/history-export.js'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { WorkoutRow, workoutDetailSheet, activityHistorySheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { useState } from 'react'
import { SearchField, Segmented } from '../components/ui.jsx'
import { saveReportFile } from '../lib/report-file.js'
import { loggedWorkouts } from '../lib/daily-plan.js'
import { todayISO } from '../lib/format.js'

async function exportHistory(S, filters) {
  const blob = new Blob([historyCsv(S, filters)], { type: 'text/csv;charset=utf-8' })
  await saveReportFile({ blob, name: `TGym-history-${todayISO()}.csv` })
}

export default function History() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const [q, setQ] = useState('')
  const [period, setPeriod] = useState('all')
  const history = loggedWorkouts(S)
  const workouts = filteredHistory(S, { query: q, period }).reverse()
  return <>
    <div className="hdr"><button className="iconbtn" onClick={() => nav('/stats')} aria-label={t('Stats')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginLeft: 12 }}><h1>{t('History')}</h1><div className="sub">{t('{0} workouts', history.length)}</div></div>
      <div className="row" style={{ gap: 4 }}><button className="iconbtn" onClick={activityHistorySheet} aria-label={t('Activity — last 12 months')} title={t('Activity — last 12 months')}><Icon name="calendar" /></button><button className="iconbtn" onClick={() => exportHistory(S, { query: q, period })} aria-label={t('Export for Excel')} title={t('Export for Excel')}><Icon name="download" /></button></div></div>
    <SearchField value={q} onChange={e => setQ(e.target.value)} onClear={() => setQ('')} placeholder={t('Search workouts or exercises…')} />
    <div style={{ height: 10 }} /><Segmented value={period} onChange={setPeriod} options={[{ value: '30', label: t('30 days') }, { value: '90', label: t('90 days') }, { value: 'all', label: t('All') }]} />
    <div style={{ height: 12 }} />
    {workouts.length ? <div className="list">{workouts.map(w => <WorkoutRow key={w.id} w={w} onClick={() => workoutDetailSheet(w)} />)}</div>
      : <div className="empty"><div className="ico"><Icon name="history" /></div>{t('No workouts yet.')}</div>}
  </>
}
