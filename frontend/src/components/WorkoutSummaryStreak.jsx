import StreakFlame from './StreakFlame.jsx'
import { streakVisual } from '../lib/streak-visual.js'
import { streakPeriod } from '../lib/streak-milestones.js'
import { t } from '../lib/i18n.js'
import './WorkoutSummaryStreak.css'

export default function WorkoutSummaryStreak({ value = 0 }) {
  const visual = streakVisual(value)
  const period = streakPeriod(value)
  const periodText = period.unit === 'day' ? null : t(period.unit === 'week'
    ? (period.value === 1 ? '1 week' : '{0} weeks')
    : (period.value === 1 ? '1 month' : '{0} months'), period.value)
  return <section className={`workout-summary-streak streak-${visual.tier} ${visual.active ? 'active' : 'inactive'}`} aria-label={t('Training streak')}>
    <StreakFlame value={value} filled />
    <div className="workout-summary-streak-copy">
      <div className="workout-summary-streak-heading"><b className="workout-summary-streak-value">{value}</b><span>{t('Training streak')}</span></div>
      {periodText && <p className="workout-summary-streak-period">{periodText}{period.remainder > 0 && <> · {t(period.remainder === 1 ? '1 day' : '{0} days', period.remainder)}</>}</p>}
      <p>{t(visual.active ? 'Your consistency is paying off. Keep the flame alive!' : 'Activity days advance the streak; missed scheduled days reset it.')}</p>
    </div>
  </section>
}
