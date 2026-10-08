import { useId, useState } from 'react'
import Icon from './Icon.jsx'
import StreakFlame from './StreakFlame.jsx'
import { streakVisual } from '../lib/streak-visual.js'
import { STREAK_CONFIG } from '../lib/streak-milestones.js'
import { t } from '../lib/i18n.js'
import './StreakMilestoneCelebration.css'

export default function StreakMilestoneCelebration({ claim, onDismiss }) {
  const titleId = useId()
  const [dismissedWeeks, setDismissedWeeks] = useState(null)
  if (!claim || !Number.isInteger(claim.weeks) || claim.weeks <= 0 || dismissedWeeks === claim.weeks) return null
  const value = claim.weeks * STREAK_CONFIG.daysPerWeek
  const visual = streakVisual(value)
  const nextWeeks = Number.isInteger(claim.nextWeeks) && claim.nextWeeks > claim.weeks ? claim.nextWeeks : null
  const dismiss = () => {
    setDismissedWeeks(claim.weeks)
    onDismiss?.()
  }

  return <section className={`streak-milestone-celebration streak-${visual.tier}`} aria-labelledby={titleId}>
    <StreakFlame value={value} />
    <div className="streak-milestone-celebration-copy" role="status">
      <div id={titleId} className="streak-milestone-celebration-title" role="heading" aria-level="3">{t('{0} weeks of consistency!', claim.weeks)}</div>
      <p>{t('You are building a lasting habit. Keep it going!')}</p>
      {nextWeeks && <p className="streak-milestone-celebration-next">{t('Next milestone: {0} weeks', nextWeeks)}</p>}
    </div>
    <button type="button" className="streak-milestone-celebration-close" aria-label={t('Close celebration')} onClick={dismiss}><Icon name="xmark" /></button>
  </section>
}
