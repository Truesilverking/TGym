import { useId } from 'react'
import { streakVisual } from '../lib/streak-visual.js'
import { STREAK_FLAME_PATH as PATH, STREAK_FLAME_INNER_PATH, STREAK_FLAME_CORE_PATH, STREAK_FLAME_COLORS as colors } from '../lib/streak-flame-path.js'

export default function StreakFlame({ value = 0, className = '' }) {
  const id = 'streak-fill-' + useId().replaceAll(':', '')
  const visual = streakVisual(value)
  const fill = visual.active ? `url(#${id})` : 'none'
  const innerFill = visual.active ? `url(#${id}-inner)` : 'none'
  const opacity = visual.active ? 1 : 0
  return <span className={`streak-flame streak-${visual.tier} ${visual.active ? 'active' : 'inactive'} ${className}`} style={{ '--streak-intensity': visual.intensity }} aria-hidden="true">
    <svg viewBox="0 0 24 24" focusable="false">
      <defs>
        <linearGradient id={id} x1="30%" y1="0%" x2="65%" y2="100%"><stop offset="0%" stopColor={colors.tip} /><stop offset="38%" stopColor={colors.orange} /><stop offset="72%" stopColor={colors.red} /><stop offset="100%" stopColor={colors.base} /></linearGradient>
        <linearGradient id={`${id}-inner`} x1="50%" y1="0%" x2="50%" y2="100%"><stop offset="0%" stopColor={colors.orange} /><stop offset="65%" stopColor={colors.inner} /><stop offset="100%" stopColor={colors.core} /></linearGradient>
      </defs>
      <path className="streak-flame-fill" d={PATH} fill={fill} opacity={opacity} style={{ fill, opacity }} />
      <path className="streak-flame-inner" d={STREAK_FLAME_INNER_PATH} fill={innerFill} opacity={opacity} style={{ fill: innerFill, opacity }} />
      <path className="streak-flame-core" d={STREAK_FLAME_CORE_PATH} fill={visual.active ? colors.core : 'none'} opacity={opacity} style={{ fill: visual.active ? colors.core : 'none', opacity }} />
      <path className="streak-flame-outline" d={PATH} />
    </svg>
  </span>
}
