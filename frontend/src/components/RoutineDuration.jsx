import { useMemo, useState } from 'react'
import { routineDurationSummary } from '../lib/stats-insights.js'
import { fmtDur } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { Segmented } from './ui.jsx'

export default function RoutineDuration({ S }) {
  const [days, setDays] = useState(90)
  const rows = useMemo(()=>routineDurationSummary(S.workouts, {routines:S.routines,activeId:S.active?.id,days}),[S.workouts,S.routines,S.active?.id,days])
  return <section className="card routine-duration" aria-labelledby="routine-duration-title">
    <h2 id="routine-duration-title">{t('Routine duration')}</h2>
    <p className="small muted">{t('Average duration by routine from completed workouts.')}</p>
    <Segmented className="seg-range" value={days} onChange={setDays} options={[{value:30,label:'1M'},{value:90,label:'3M'},{value:365,label:'1Y'},{value:0,label:t('All')}]} />
    {rows.length ? <ul className="routine-duration-list">{rows.map(row=><li key={row.key}>
      <div className="routine-duration-name"><strong>{row.name || t('Freestyle')}</strong><span className="small muted">{t(row.count===1 ? '{0} workout' : '{0} workouts',row.count)}</span></div>
      <div className="routine-duration-value"><strong>{fmtDur(row.meanMs)}</strong><span className="small muted">{t('Average duration')}</span><span className="small dim">{t('Median: {0}',fmtDur(row.medianMs))}</span></div>
    </li>)}</ul> : <p className="muted small">{t('No completed workouts with a valid duration in this period.')}</p>}
  </section>
}
