import { routineConsistency } from '../lib/stats-insights.js'
import { t } from '../lib/i18n.js'
import { Button } from './ui.jsx'

export default function ConsistencyCard({ S, onTimes }) {
  const stats = routineConsistency(S)
  return <section className="card consistency-card">
    <div className="consistency-heading"><div><h2>{t('Consistency')}</h2><p className="muted small">{t('Last 8 weeks')}</p></div><Button className="times-action" icon="timer" onClick={onTimes}>{t('Times')}</Button></div>
    <dl className="consistency-metrics">{[
      ['Completed', stats.completed], ['Completion', stats.rate == null ? '—' : Math.round(stats.rate * 100) + '%'],
      ['Planned', stats.planned], ['Missed', stats.missed], ['Extra', stats.extra],
    ].map(([label, value]) => <div key={label}><dt>{t(label)}</dt><dd>{value}</dd></div>)}</dl>
  </section>
}
