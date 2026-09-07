import { useId } from 'react'
import { streakVisual } from '../lib/streak-visual.js'

const PATH = 'M12 20.4c3.2 0 5.4-2.1 5.4-5.1 0-3.9-3.4-5.6-2.6-9.8-2.5.8-4 2.9-4 5.1 0 1-.5 1.6-1.2 1.6-.8 0-1.2-.7-1.2-1.8-1.1 1.2-1.8 2.9-1.8 4.9 0 3 2.2 5.1 5.4 5.1Z'

export default function StreakFlame({ value = 0, className = '' }) {
  const id = useId().replaceAll(':', '')
  const visual = streakVisual(value)
  const y = 24 * (1 - visual.progress)
  return <span className={`streak-flame streak-${visual.tier} ${visual.active ? 'active' : 'inactive'} ${className}`} style={{ '--streak-intensity': visual.intensity }} aria-hidden="true">
    <svg viewBox="0 0 24 24" focusable="false">
      <defs><clipPath id={id}><path d={PATH} /></clipPath></defs>
      <path className="streak-flame-outline" d={PATH} />
      <rect className="streak-flame-fill" x="0" y={y} width="24" height={24 - y} clipPath={`url(#${id})`} />
    </svg>
  </span>
}
