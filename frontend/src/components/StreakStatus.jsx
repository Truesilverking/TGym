import { t } from '../lib/i18n.js'

// One description for the derived state used by every streak surface.
export function streakStatusText(streak) {
  switch (streak?.state) {
    case 'pending': return t("Complete today's workout to keep your streak.")
    case 'rest': return t('No workout scheduled today — streak preserved.')
    case 'paused': return t('Training paused — streak preserved.')
    case 'interrupted': return t('Streak interrupted. Complete a workout to start a new one.')
    case 'active': return t('Your consistency is paying off. Keep the flame alive!')
    default: return t('Complete a workout to start a streak.')
  }
}

export default function StreakStatus({ streak, className = '' }) {
  return <p className={`streak-status ${className}`} data-streak-state={streak.state}>{streakStatusText(streak)}</p>
}
