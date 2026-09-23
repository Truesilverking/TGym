import { useMemo, useState } from 'react'
import { routineDurationSummary } from '../lib/stats-insights.js'
import { fmtDur } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { SelectRow } from './ui.jsx'
import Icon from './Icon.jsx'

export default function RoutineDuration({ S }) {
  const [days, setDays] = useState(90)
  const duration = ms => ms < 60000 ? Math.round(ms / 1000) + 's' : fmtDur(ms)
  const rows = useMemo(()=>routineDurationSummary(S.workouts, {routines:S.routines,activeId:S.active?.id,days}),[S.workouts,S.routines,S.active?.id,days])
  const scale = Math.max(1,...rows.flatMap(row=>[row.meanMs,row.medianMs]))
  return <section className="card routine-duration insight-panel" aria-labelledby="routine-duration-title">
    <div className="insight-heading"><div><h2 id="routine-duration-title">{t('Routine duration')}</h2><p className="small muted">{t('Plan your time with the typical length of each routine.')}</p></div>
      <div className="duration-period"><SelectRow icon="calendar" title={t('Period')} value={days} onChange={setDays} options={[{value:30,label:t('Last 30 days')},{value:90,label:t('Last 3 months')},{value:365,label:t('Last 12 months')},{value:0,label:t('All time')}]} /></div>
    </div>
    {rows.length ? <><ul className="routine-duration-list">{rows.map(row=><li key={row.key}>
      <div className="routine-duration-name"><strong>{row.name || t('Freestyle')}</strong><span className="small muted">{t(row.count===1 ? '{0} workout' : '{0} workouts',row.count)}</span></div>
      <dl className="duration-readings"><div><dt>{t('Average duration')}</dt><dd>{duration(row.meanMs)}</dd></div><div><dt>{t('Median')}</dt><dd>{duration(row.medianMs)}</dd></div></dl>
      {rows.length > 1 && <div className="duration-track" aria-hidden="true"><span style={{width:`${row.meanMs/scale*100}%`}} /><i style={{left:`${row.medianMs/scale*100}%`}} /></div>}
    </li>)}</ul>{rows.length > 1 && <p className="duration-legend small muted"><span className="duration-legend-key" aria-hidden="true" />{t('Bar: average · marker: median. Longer does not mean better.')}</p>}</> : <div className="insight-empty"><Icon name="timer" /><p>{t('No completed workouts with a valid duration in this period.')}</p></div>}
  </section>
}
