import { isoOf } from './format.js'
import { trainingStreak } from './training-plan.js'
import { trackingStart } from './training-history.js'

// Presentation counters share the streak's valid, once-per-local-date activity.
// Calendar completion/partial states and persisted workout data stay independent.
export function calendarActivity(state, now = new Date()) {
  const streak = trainingStreak(state, now)
  return {
    today: streak.date,
    trackedSince: trackingStart(state, streak.date),
    current: streak.current,
    best: streak.best,
    dates: new Set(streak.rows.filter(row => row.status === 'completed').map(row => row.iso)),
  }
}

export function calendarActivityCount(activity, start, end) {
  let count = 0
  for (const iso of activity.dates) if (iso >= start && iso <= end) count++
  return count
}

export function calendarMonth(year, month) {
  const first = new Date(year, month, 1, 12)
  const length = new Date(year, month + 1, 0, 12).getDate()
  const days = Array.from({ length }, (_, index) => isoOf(new Date(year, month, index + 1, 12)))
  return { start: days[0], end: days.at(-1), offset: (first.getDay() + 6) % 7, days }
}
