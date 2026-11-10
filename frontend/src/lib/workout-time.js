const n = value => Number.isFinite(Number(value)) ? Number(value) : 0

/** The shared timestamp clock, including pauses repaired after process suspension. */
export function workoutElapsedMs(workout, now = Date.now()) {
  if (!workout) return 0
  const start = n(workout.start)
  let terminal = n(workout.end ?? workout.timerPausedAt ?? workout.routineCompletedAt ?? workout.completedAt ?? now)
  // A suspended UI may read before persistence has reconciled. It must display the same
  // cutoff the next store write will use; background intervals are never authoritative.
  if (workout.end == null && workout.timerPausedAt == null && workout.routineCompletedAt == null && workout.completedAt == null) terminal = Math.min(terminal, inactivityDeadline(workout, now))
  let paused = Math.max(0, n(workout.pausedDurationMs))
  if (workout.end != null && workout.timerPausedAt != null) paused += Math.max(0, n(workout.end) - n(workout.timerPausedAt))
  return Math.max(0, terminal - start - paused)
}

export function pauseWorkoutClock(workout, now = Date.now(), reason = 'completion') {
  if (!workout || workout.timerPausedAt != null || workout.end != null) return workout
  const next = { ...workout, timerPausedAt: Math.max(n(workout.start), n(now)), pauseReason: reason }
  delete next.timerContinuedAt
  return next
}

export function resumeWorkoutClock(workout, now = Date.now()) {
  if (!workout || workout.timerPausedAt == null || workout.end != null) return workout
  const pausedDurationMs = Math.max(0, n(workout.pausedDurationMs)) + Math.max(0, n(now) - n(workout.timerPausedAt))
  const next = { ...workout, pausedDurationMs, lastMeaningfulTrainingActivityAt: n(now), lastMeaningfulWorkoutActivityAt: n(now), lastUserInteractionAt: n(now), lastActivityAt: n(now), timerContinuedAt: n(now) }
  delete next.timerPausedAt
  delete next.completedAt
  delete next.routineCompletedAt
  delete next.pauseReason
  return next
}

export const INACTIVITY_LIMIT_MS = 30 * 60000
export function inactivityState(workout, now = Date.now()) {
  return workout && workout.end == null && workout.timerPausedAt == null && workout.routineCompletedAt == null && now >= inactivityDeadline(workout, now) ? 'pause' : 'none'
}
export function lastWorkoutInteraction(workout, now = Date.now()) {
  if (!workout) return 0
  const start = n(workout.start)
  // New sessions use actual input. Legacy sessions use the recorded training evidence
  // once; work/rest deadlines and autonomous completion callbacks never extend it.
  const recorded = [workout.lastUserInteractionAt,workout.lastMeaningfulTrainingActivityAt,workout.lastMeaningfulWorkoutActivityAt]
    .find(value=>value != null && Number.isFinite(Number(value)) && Number(value)>=start && Number(value)<=now)
  return recorded == null ? lastWorkoutActivity(workout, now) : Number(recorded)
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
export const inactivityDeadline = (workout, now = Date.now()) => lastWorkoutInteraction(workout, now) + INACTIVITY_LIMIT_MS

export function finishWorkoutClock(workout, end = Date.now()) {
  if (!workout) return workout
  if (workout.end != null) return workout
  const terminal = n(workout.routineCompletedAt ?? workout.timerPausedAt ?? workout.completedAt ?? end)
  const deadline = inactivityDeadline(workout, end)
  const overdue = workout.timerPausedAt == null && workout.routineCompletedAt == null && workout.completedAt == null && terminal >= deadline
  const next = { ...workout, end: overdue ? deadline : terminal, ...(overdue ? {pauseReason:'inactivity'} : {}) }

  delete next.timerPausedAt
  delete next.completedAt
  return next
}

// Additive aliases: the original clock remains authoritative for old backups/consumers.
export function sessionTiming(workout, now = Date.now()) {
  if (!workout) return workout
  return { ...workout, sessionStartedAt: workout.start, lastActivityAt: lastWorkoutInteraction(workout,now),
    accumulatedActiveDuration: workoutElapsedMs(workout, now),
    sessionStatus: workout.end != null ? (workout.finishReason === 'abandoned' ? 'abandoned' : workout.finishReason === 'auto_completed' ? 'auto_completed' : workout.finishReason === 'inactivity' ? 'ended_by_inactivity' : 'completed') : workout.timerPausedAt != null ? (workout.pauseReason === 'completion' ? 'awaiting_finish' : 'paused') : 'active',
    endedAt: workout.end ?? null }
}
export function recordWorkoutActivity(workout, now = Date.now()) {
  if (!workout || workout.end != null) return workout
  return sessionTiming({ ...workout, lastUserInteractionAt: now, lastActivityAt: now, lastMeaningfulTrainingActivityAt: now, lastMeaningfulWorkoutActivityAt: now }, now)
}
export function recordWorkoutInteraction(workout, now = Date.now()) {
  if (!workout || workout.end != null) return workout
  return sessionTiming({ ...workout, lastUserInteractionAt: now }, now)
}

// Explicit user correction changes the terminal timestamp, retaining the audit trail.
export function correctWorkoutDuration(workout, minutes, now=Date.now()) {
  const duration=Number(minutes)*60000, paused=Math.max(0,n(workout?.pausedDurationMs))
  const end=n(workout?.start)+paused+duration
  if (!workout || (workout.end == null && workout.timerPausedAt == null) || !Number.isFinite(duration) || duration<=0 || end>now) return null
  if (workout.end == null) {
    const next = {...workout, timerPausedAt:end, durationCorrectedAt:now,
      originalTimerPausedAt:workout.originalTimerPausedAt ?? workout.timerPausedAt,
      originalDurationMs:workout.originalDurationMs ?? workoutElapsedMs(workout, now)}
    if (next.routineCompletedAt != null) next.routineCompletedAt = end
    return sessionTiming(next, now)
  }
  const next={...workout,end,endedAt:end,accumulatedActiveDuration:duration,durationCorrectedAt:now,originalEndedAt:workout.originalEndedAt ?? workout.end}
  delete next.timerPausedAt
  return next
}
