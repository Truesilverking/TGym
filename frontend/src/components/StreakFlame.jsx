import { useId } from 'react'
import { streakVisual } from '../lib/streak-visual.js'
import { STREAK_FLAME_PATH as PATH } from '../lib/streak-flame-path.js'

export default function StreakFlame({ value = 0, className = '' }) {
  const id = 'streak-fill-' + useId().replaceAll(':', '')
  const visual = streakVisual(value)
  const fill = visual.active ? `url(#${id})` : 'none'
  const opacity = visual.active ? 1 : 0
  return <span className={`streak-flame streak-${visual.tier} ${visual.active ? 'active' : 'inactive'} ${className}`} style={{ '--streak-intensity': visual.intensity }} aria-hidden="true">
    <svg viewBox="0 0 24 24" focusable="false">
      <defs><linearGradient id={id} x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="var(--streak-flame-yellow, #ffd60a)" /><stop offset="100%" stopColor="var(--streak-flame-orange, #ff9f0a)" /></linearGradient></defs>
      <path className="streak-flame-fill" d={PATH} fill={fill} opacity={opacity} style={{ fill, opacity }} />
      <path className="streak-flame-outline" d={PATH} />
    </svg>
  </span>
}
