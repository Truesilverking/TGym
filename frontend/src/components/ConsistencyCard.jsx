import { routineConsistency } from '../lib/stats-insights.js'
import { t } from '../lib/i18n.js'
import { Button } from './ui.jsx'

export default function ConsistencyCard({ S, onTimes }) {
  const stats = routineConsistency(S)
  const percent = stats.rate == null ? null : Math.round(stats.rate * 100)
  return <section className="card consistency-card insight-panel">
    <div className="consistency-heading insight-heading"><div><h2>{t('Consistency')}</h2><p className="muted small">{t('Last 8 weeks')}</p></div><Button className="times-action" icon="timer" onClick={onTimes}>{t('Times')}</Button></div>
    <div className="consistency-summary">
      <dl className="consistency-primary consistency-metrics">
        <div><dt>{t('Completed')}</dt><dd>{stats.completed}</dd></div>
        <div><dt>{t('Completion')}</dt><dd>{percent == null ? '—' : percent+'%'}</dd></div>
      </dl>
      <div className="consistency-track" role={percent == null ? undefined : 'meter'} aria-label={percent == null ? undefined : t('Completion')} aria-valuemin={percent == null ? undefined : 0} aria-valuemax={percent == null ? undefined : 100} aria-valuenow={percent ?? undefined} aria-hidden={percent == null ? true : undefined}><span style={{width:`${percent ?? 0}%`}} /></div>
      {percent == null && <p className="small muted consistency-empty">{t('No scheduled sessions to evaluate yet.')}</p>}
    </div>
    <dl className="consistency-secondary consistency-metrics">{[['Planned',stats.planned],['Missed',stats.missed],['Extra',stats.extra]].map(([label,value])=><div key={label}><dt>{t(label)}</dt><dd>{value}</dd></div>)}</dl>
  </section>
}
