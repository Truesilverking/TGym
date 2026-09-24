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
  const next = { ...workout, timerPausedAt: n(now) }
  delete next.timerContinuedAt
  return next
}

export function resumeWorkoutClock(workout, now = Date.now()) {
  if (!workout || workout.timerPausedAt == null || workout.end != null) return workout
  const pausedDurationMs = Math.max(0, n(workout.pausedDurationMs)) + Math.max(0, n(now) - n(workout.timerPausedAt))
  const next = { ...workout, pausedDurationMs, lastMeaningfulWorkoutActivityAt: n(now), lastActivityAt: n(now), timerContinuedAt: n(now) }
  delete next.timerPausedAt
  delete next.completedAt
  return next
}

export const INACTIVITY_WARNING_MINUTES = 20
export const INACTIVITY_AUTO_FINISH_MINUTES = 30
export function inactivityState(workout, now = Date.now()) {
  if (!workout || workout.end != null || workout.timerPausedAt != null) return 'none'
  const last = lastWorkoutActivity(workout)
  const idle = Math.max(0, now - last)
  return idle >= INACTIVITY_AUTO_FINISH_MINUTES * 60000 ? 'finish' : idle >= INACTIVITY_WARNING_MINUTES * 60000 ? 'warning' : 'none'
}
export function lastWorkoutActivity(workout) {
  return Math.max(n(workout.start), n(workout.lastActivityAt), n(workout.lastMeaningfulWorkoutActivityAt))
}

export function finishWorkoutClock(workout, end = Date.now()) {
  if (!workout) return workout
  if (workout.end != null) return workout
  const next = { ...workout, end: n(workout.timerPausedAt ?? workout.completedAt ?? end) }

  delete next.timerPausedAt
  delete next.completedAt
  return next
}

export const inactivityDeadline = workout => lastWorkoutActivity(workout) + INACTIVITY_AUTO_FINISH_MINUTES * 60000
// Additive aliases: the original clock remains authoritative for old backups/consumers.
export function sessionTiming(workout, now = Date.now()) {
  if (!workout) return workout
  return { ...workout, sessionStartedAt: workout.start, lastActivityAt: lastWorkoutActivity(workout),
    accumulatedActiveDuration: workoutElapsedMs(workout, now),
    sessionStatus: workout.end != null ? (workout.finishReason === 'inactivity' ? 'ended_by_inactivity' : 'completed') : workout.timerPausedAt != null ? 'paused' : 'active',
    endedAt: workout.end ?? null }
}
export function recordWorkoutActivity(workout, now = Date.now()) {
  if (!workout || workout.end != null || inactivityState(workout, now) === 'finish') return workout
  return sessionTiming({ ...workout, lastActivityAt: now, lastMeaningfulWorkoutActivityAt: now }, now)
}
