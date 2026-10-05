import { displayReps, isPerSide, modeOf } from '../lib/history.js'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { WorkoutRow, workoutDetailSheet, activityHistorySheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { useState } from 'react'
import { exOr } from '../lib/exercises.js'
import { exerciseNameFor } from '../lib/i18n.js'
import { SearchField, Segmented } from '../components/ui.jsx'
import { saveReportFile } from '../lib/report-file.js'
import { dateLocale } from '../lib/i18n.js'
import { workoutElapsedMs } from '../lib/workout-time.js'
import { loggedWorkouts } from '../lib/daily-plan.js'
import { isoOf, todayISO } from '../lib/format.js'
import { isWarmupRow } from '../lib/workout-model.js'

const csvCell = value => {
  const text = String(value ?? '')
  // CSV quoting does not stop spreadsheet formula evaluation of user-entered text.
  const safe = typeof value === 'string' && /^(?:\s*[=+@-]|[\t\r\n])/.test(text) ? "'" + text : text
  return `"${safe.replaceAll('"', '""')}"`
}
export function filteredHistory(S, { query = '', period = 'all', now = Date.now() } = {}) {
  const cutoff = period === 'all' ? '' : isoOf(new Date(now - Number(period) * 86400000))
  const needle = query.trim().toLocaleLowerCase()
  return loggedWorkouts(S).filter(w => (!cutoff || w.d >= cutoff) && (!needle || [w.name, w.d, w.note, ...(w.entries || []).map(e => exerciseNameFor(exOr(e.id))), ...(w.entries || []).map(e => S.exerciseAliases?.[e.id] || '')].join(' ').toLocaleLowerCase().includes(needle)))
}
export function historyCsv(S, filters) {
  const rows = [[t('Date'), t('Start time'), t('End time'), t('Workout duration (min)'), t('Routine'), t('Exercise'), t('Alias'), t('Set'), t('Weight'), t('Unit'), t('Reps'), t('Set duration (s)'), t('Notes'), t('Activity type'), t('Source'), t('Distance (km)'), t('Average heart rate (bpm)'), t('Energy (kcal)'), t('Steps'), t('Elevation gain (m)'), t('Perceived effort (1–10)')]]
  rows[0].push(t('Completed'), t('Warm-up'), t('RIR'), t('RPE'), t('Reps per side'))
  for (const w of filteredHistory(S, filters)) for (const e of w.entries || []) {
    const ex = exOr(e.id)
    const sets = e.sets?.length ? e.sets : [{}]
    const start = Number(w.start) > 0 && Number.isFinite(Number(w.start)) ? new Date(Number(w.start)).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' }) : ''
    const end = Number(w.end) > Number(w.start) ? new Date(Number(w.end)).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' }) : ''
    const duration = Number(w.end) > Number(w.start) ? Math.round(workoutElapsedMs(w) / 60000) : ''
    sets.forEach((s, i) => rows.push([w.d, start, end, duration, w.name, exerciseNameFor(ex), S.exerciseAliases?.[e.id] || '', i + 1, s.w ?? '', s.unit || w.unit || S.unit, displayReps(s.r, e.target) ?? '', s.sec ?? '', w.note || '', w.activity?.type || e.target?.activityType || '', w.activity?.source || '', w.activity?.distanceKm ?? s.distanceKm ?? '', w.activity?.averageHeartRate ?? '', w.activity?.calories ?? '', w.activity?.steps ?? '', w.activity?.elevationM ?? '', w.activity?.rpe ?? '', t(s.done ? 'Completed' : 'Pending'), isWarmupRow(s) ? t('Warm-up') : '', s.rir ?? '', s.rpe ?? '', isPerSide(e.target) && modeOf(e.target) === 'reps' ? displayReps(s.r, e.target) ?? '' : '']))
  }
  return '\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n')
}

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
