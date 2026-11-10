import { streakVisual } from '../lib/streak-visual.js'
import { STREAK_FLAME_PATH as PATH } from '../lib/streak-flame-path.js'
import { STREAK_FLAME_IMAGE } from '../lib/streak-flame-image.js'

export default function StreakFlame({ value = 0, className = '' }) {
  const visual = streakVisual(value)
  return <span className={`streak-flame streak-${visual.tier} ${visual.active ? 'active' : 'inactive'} ${className}`} style={{ '--streak-intensity': visual.intensity }} aria-hidden="true">
    <svg viewBox="0 0 24 24" focusable="false" draggable="false">
      {visual.active
        ? <image className="streak-flame-fill" href={STREAK_FLAME_IMAGE} x="0" y="0" width="24" height="24" preserveAspectRatio="xMidYMid meet" draggable="false" opacity="1" style={{ opacity: 1 }} />
        : <>
          <path className="streak-flame-fill" d={PATH} fill="none" opacity="0" style={{ fill: 'none', opacity: 0 }} />
          <path className="streak-flame-outline" d={PATH} />
        </>}
    </svg>
  </span>
}
