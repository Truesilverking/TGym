import { useId } from 'react'
import { streakVisual } from '../lib/streak-visual.js'

const PATH = 'M12 20.4c3.2 0 5.4-2.1 5.4-5.1 0-3.9-3.4-5.6-2.6-9.8-2.5.8-4 2.9-4 5.1 0 1-.5 1.6-1.2 1.6-.8 0-1.2-.7-1.2-1.8-1.1 1.2-1.8 2.9-1.8 4.9 0 3 2.2 5.1 5.4 5.1Z'

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
