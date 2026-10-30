import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { t, exerciseNameFor, exerciseNameSearchText } from '../lib/i18n.js'
import { fmtNum, fmtDate, isoOf } from '../lib/format.js'
import { EXIDX } from '../lib/exercises.js'
import { personalRecords, recentRecords } from '../lib/personal-records.js'
import { exerciseDetailSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { SearchField } from '../components/ui.jsx'
import ModuleSwitch, { PROGRESS_VIEWS } from '../components/ModuleSwitch.jsx'

// Personal records: one row per exercise with its heaviest set and best estimated 1RM.
export default function Records() {
  const S = useStore(s => s.S)
  const [q, setQ] = useState('')
  const records = useMemo(() => personalRecords(S), [S.workouts])
  const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30)
  const recentIds = new Set(recentRecords(records, isoOf(monthAgo)).map(r => r.id))
  const exerciseOf = rec => EXIDX[rec.id] || (S.customEx || []).find(e => e.id === rec.id) || { id: rec.id, n: rec.entry?.n || rec.id }
  const nameOf = rec => exerciseNameFor(exerciseOf(rec), { entry: rec.entry, routineId: rec.routineId })
  const query = q.trim().toLowerCase()
  const shown = query ? records.filter(rec => `${nameOf(rec)} ${exerciseNameSearchText(exerciseOf(rec))}`.toLowerCase().includes(query)) : records

  return <>
    <div className="hdr"><div style={{ minWidth: 0 }}><h1>{t('Personal records')}</h1><div className="sub">{t('{0} exercises with a record', records.length)}</div></div></div>
    <ModuleSwitch items={PROGRESS_VIEWS} current="/records" />
    {records.length > 0 && <SearchField value={q} onChange={e => setQ(e.target.value)} onClear={() => setQ('')} placeholder={t('Search exercises…')} aria-label={t('Search exercises…')} />}
    <div style={{ height: 12 }} />
    {records.length ? <div className="record-list">
      {shown.map(rec => (
        <button key={rec.id} type="button" className="record-row" onClick={() => EXIDX[rec.id] || (S.customEx || []).some(e => e.id === rec.id) ? exerciseDetailSheet(exerciseOf(rec)) : null}>
          <span className="record-main">
            <b>{nameOf(rec)}</b>
            <small>{t('{0} sessions · last record {1}', rec.sessions, fmtDate(rec.recordDate, true))}</small>
          </span>
          {recentIds.has(rec.id) && <span className="tag acc nocap">{t('New')}</span>}
          <span className="record-figures">
            {rec.bestWeight && <span><span className="metric-value">{fmtNum(rec.bestWeight.w)}</span><small>{S.unit} · {t('Top set')}</small></span>}
            {rec.best1RM && <span><span className="metric-value">{fmtNum(rec.best1RM.est)}</span><small>{S.unit} · {t('Est. 1RM')}</small></span>}
          </span>
        </button>
      ))}
      {!shown.length && <p className="muted small" style={{ padding: 12 }}>{t('No match')}</p>}
    </div> : <div className="empty"><div className="ico"><Icon name="trophy" /></div>{t('Finish a workout with weighted sets to start your records.')}</div>}
  </>
}
