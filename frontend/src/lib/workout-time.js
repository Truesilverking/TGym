const n = value => Number.isFinite(Number(value)) ? Number(value) : 0

/** Duration of a workout excluding time spent paused in a finish decision. */
export function workoutElapsedMs(workout, now = Date.now()) {
  if (!workout) return 0
  const start = n(workout.start)
  const terminal = n(workout.end ?? workout.timerPausedAt ?? workout.routineCompletedAt ?? workout.completedAt ?? now)
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
  const next = { ...workout, pausedDurationMs, lastMeaningfulTrainingActivityAt: n(now), lastMeaningfulWorkoutActivityAt: n(now), lastActivityAt: n(now), timerContinuedAt: n(now) }
  delete next.timerPausedAt
  delete next.completedAt
  delete next.routineCompletedAt
  delete next.pauseReason
  return next
}

export const COMPLETION_GRACE_MS = 10 * 60000
export const STALE_SESSION_MS = 4 * 60 * 60000
// Compatibility API: an incomplete routine never expires from touch inactivity.
export function inactivityState(workout, now = Date.now()) {
  return workout && workout.end == null && workout.routineCompletedAt != null &&
    workout.timerPausedAt != null && now >= Number(workout.routineCompletedAt) + COMPLETION_GRACE_MS ? 'finish' : 'none'
}
export function lastWorkoutActivity(workout, now = Date.now()) {
  if (!workout) return 0
  const rows=(workout.entries || []).flatMap(e=>e.sets || []).map(s=>n(s.doneAt))
  const start=n(workout.start)
  return Math.max(start,...[n(workout.lastMeaningfulTrainingActivityAt ?? workout.lastMeaningfulWorkoutActivityAt),...rows].filter(t=>t>=start && t<=now))
}
// Preserve only a deadline created by real training, not the time of detection.
export function lastTrainingBoundary(workout, now = Date.now()) {
  const last=lastWorkoutActivity(workout,now)
  const deadlines=[workout?.restTimer?.endsAt,workout?.lastRestEndedAt,workout?.lastWorkEndedAt,workout?.workEndsAt]
    .map(n).filter(t=>t>=last && t<=now)
  return Math.min(now,Math.max(last,...deadlines))
}
export const inactivityDeadline = workout => Number(workout?.routineCompletedAt) + COMPLETION_GRACE_MS

export function finishWorkoutClock(workout, end = Date.now()) {
  if (!workout) return workout
  if (workout.end != null) return workout
  const next = { ...workout, end: n(workout.routineCompletedAt ?? workout.timerPausedAt ?? workout.completedAt ?? end) }

  delete next.timerPausedAt
  delete next.completedAt
  return next
}

// Additive aliases: the original clock remains authoritative for old backups/consumers.
export function sessionTiming(workout, now = Date.now()) {
  if (!workout) return workout
  return { ...workout, sessionStartedAt: workout.start, lastActivityAt: lastWorkoutActivity(workout,now),
    accumulatedActiveDuration: workoutElapsedMs(workout, now),
    sessionStatus: workout.end != null ? (workout.finishReason === 'abandoned' ? 'abandoned' : workout.finishReason === 'auto_completed' ? 'auto_completed' : workout.finishReason === 'inactivity' ? 'ended_by_inactivity' : 'completed') : workout.routineCompletedAt != null ? 'awaiting_finish' : workout.timerPausedAt != null ? 'paused' : 'active',
    endedAt: workout.end ?? null }
}
export function recordWorkoutActivity(workout, now = Date.now()) {
  if (!workout || workout.end != null) return workout
  return sessionTiming({ ...workout, lastActivityAt: now, lastMeaningfulTrainingActivityAt: now, lastMeaningfulWorkoutActivityAt: now }, now)
}

// Explicit user correction changes the terminal timestamp, retaining the audit trail.
export function correctWorkoutDuration(workout, minutes, now=Date.now()) {
  const duration=Number(minutes)*60000, paused=Math.max(0,n(workout?.pausedDurationMs))
  const end=n(workout?.start)+paused+duration
  if (!workout || workout.end == null || !Number.isFinite(duration) || duration<=0 || end>now) return null
  const next={...workout,end,endedAt:end,accumulatedActiveDuration:duration,durationCorrectedAt:now,originalEndedAt:workout.originalEndedAt ?? workout.end}
  delete next.timerPausedAt
  return next
}
