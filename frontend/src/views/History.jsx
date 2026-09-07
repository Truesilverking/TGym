import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { WorkoutRow, workoutDetailSheet, activityHistorySheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { useState } from 'react'
import { exOr } from '../lib/exercises.js'
import { exerciseNameFor } from '../lib/i18n.js'
import { SearchField, Segmented } from '../components/ui.jsx'
import { MOBILE, shareExport } from '../lib/mobile.js'
import { dateLocale } from '../lib/i18n.js'
import { workoutElapsedMs } from '../lib/workout-time.js'

const csvCell = value => `"${String(value ?? '').replaceAll('"', '""')}"`
export function historyCsv(S) {
  const rows = [[t('Date'), t('Start time'), t('End time'), t('Workout duration (min)'), t('Routine'), t('Exercise'), t('Alias'), t('Set'), t('Weight'), t('Unit'), t('Reps'), t('Set duration (s)'), t('Notes')]]
  for (const w of S.workouts || []) for (const e of w.entries || []) {
    const ex = exOr(e.id)
    const sets = e.sets?.length ? e.sets : [{}]
    const start = Number.isFinite(Number(w.start)) ? new Date(w.start).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' }) : ''
    const end = Number(w.end) > Number(w.start) ? new Date(w.end).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' }) : ''
    const duration = Number(w.end) > Number(w.start) ? Math.round(workoutElapsedMs(w) / 60000) : ''
    sets.forEach((s, i) => rows.push([w.d, start, end, duration, w.name, exerciseNameFor(ex), S.exerciseAliases?.[e.id] || '', i + 1, s.w ?? '', s.unit || S.unit, s.r ?? '', s.sec ?? '', w.note || '']))
  }
  return '\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n')
}

async function exportHistory(S) {
  const csv = historyCsv(S), filename = `framegym-history-${new Date().toISOString().slice(0, 10)}.csv`
  if (MOBILE) { await shareExport(csv, filename); return }
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob), a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function History() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const [q, setQ] = useState('')
  const [period, setPeriod] = useState('all')
  const cutoff = period === 'all' ? '' : new Date(Date.now() - Number(period) * 86400000).toISOString().slice(0, 10)
  const needle = q.trim().toLocaleLowerCase()
  const workouts = [...S.workouts].reverse().filter(w => (!cutoff || w.d >= cutoff) && (!needle || [w.name, w.d, w.note, ...w.entries.map(e => exerciseNameFor(exOr(e.id))), ...w.entries.map(e => S.exerciseAliases?.[e.id] || '')].join(' ').toLocaleLowerCase().includes(needle)))
  return <>
    <div className="hdr"><button className="iconbtn" onClick={() => nav('/stats')} aria-label={t('Stats')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginLeft: 12 }}><h1>{t('History')}</h1><div className="sub">{t('{0} workouts', S.workouts.length)}</div></div>
      <div className="row" style={{ gap: 4 }}><button className="iconbtn" onClick={activityHistorySheet} aria-label={t('Activity — last 12 months')} title={t('Activity — last 12 months')}><Icon name="calendar" /></button><button className="iconbtn" onClick={() => exportHistory(S)} aria-label={t('Export for Excel')} title={t('Export for Excel')}><Icon name="download" /></button></div></div>
    <SearchField value={q} onChange={e => setQ(e.target.value)} onClear={() => setQ('')} placeholder={t('Search workouts or exercises…')} />
    <div style={{ height: 10 }} /><Segmented value={period} onChange={setPeriod} options={[{ value: '30', label: t('30 days') }, { value: '90', label: t('90 days') }, { value: 'all', label: t('All') }]} />
    <div style={{ height: 12 }} />
    {workouts.length ? <div className="list">{workouts.map(w => <WorkoutRow key={w.id} w={w} onClick={() => workoutDetailSheet(w)} />)}</div>
      : <div className="empty"><div className="ico"><Icon name="history" /></div>{t('No workouts yet.')}</div>}
  </>
}
