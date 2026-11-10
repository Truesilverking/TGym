import StreakFlame from './StreakFlame.jsx'
import StreakStatus from './StreakStatus.jsx'
import { streakVisual } from '../lib/streak-visual.js'
import { streakPeriod } from '../lib/streak-milestones.js'
import { t } from '../lib/i18n.js'
import './WorkoutSummaryStreak.css'

export default function WorkoutSummaryStreak({ streak, value = streak?.current ?? 0 }) {
  const state = streak || { current: value, state: value > 0 ? 'active' : 'inactive' }
  const visual = streakVisual(value)
  const period = streakPeriod(value)
  const periodText = period.unit === 'day' ? null : t(period.unit === 'week'
    ? (period.value === 1 ? '1 week' : '{0} weeks')
    : (period.value === 1 ? '1 month' : '{0} months'), period.value)
  return <section className={`workout-summary-streak streak-${visual.tier} ${visual.active ? 'active' : 'inactive'}`} data-streak-state={state.state} aria-label={t('Training streak')}>
    <StreakFlame value={value} />
    <div className="workout-summary-streak-copy">
      <div className="workout-summary-streak-heading"><b className="workout-summary-streak-value">{value}</b><span>{t('Training days in this streak')}</span></div>
      {periodText && <p className="workout-summary-streak-period">{periodText}{period.remainder > 0 && <> · {t(period.remainder === 1 ? '1 day' : '{0} days', period.remainder)}</>}</p>}
      {periodText && <p className="workout-summary-streak-equivalent">{t('Week and month equivalents use completed training days: 7 per week and 30 per month.')}</p>}
      <StreakStatus streak={state} />
    </div>
  </section>
}
