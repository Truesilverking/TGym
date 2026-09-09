const n = value => Number.isFinite(Number(value)) ? Number(value) : 0

/** Duration of a workout excluding time spent paused in a finish decision. */
export function workoutElapsedMs(workout, now = Date.now()) {
  if (!workout) return 0
  const start = n(workout.start)
  const terminal = n(workout.end ?? workout.timerPausedAt ?? workout.completedAt ?? now)
  let paused = Math.max(0, n(workout.pausedDurationMs))
  if (workout.end != null && workout.timerPausedAt != null) paused += Math.max(0, n(workout.end) - n(workout.timerPausedAt))
  return Math.max(0, terminal - start - paused)
}

export function pauseWorkoutClock(workout, now = Date.now()) {
  if (!workout || workout.timerPausedAt != null || workout.end != null) return workout
  return { ...workout, timerPausedAt: n(now) }
}

export function resumeWorkoutClock(workout, now = Date.now()) {
  if (!workout || workout.timerPausedAt == null || workout.end != null) return workout
  const pausedDurationMs = Math.max(0, n(workout.pausedDurationMs)) + Math.max(0, n(now) - n(workout.timerPausedAt))
  const next = { ...workout, pausedDurationMs }
  delete next.timerPausedAt
  delete next.completedAt
  return next
}

export function finishWorkoutClock(workout, end = Date.now()) {
  if (!workout) return workout
  if (workout.end != null) return workout
  const next = { ...workout, end: n(workout.timerPausedAt ?? workout.completedAt ?? end) }

  delete next.timerPausedAt
  delete next.completedAt
  return next
}
