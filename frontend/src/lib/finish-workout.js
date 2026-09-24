// The persisted boundary for a finished session. Keep this pure so compatibility tests can
// exercise the exact shape the UI writes without mounting React or mutating store state.
import { finishWorkoutClock, sessionTiming } from './workout-time.js'

export function buildCompletedWorkout(active, { end = Date.now(), prs = [], reason = 'manual', snapshotFor } = {}) {
  const timing = sessionTiming({...finishWorkoutClock(active, end),finishReason:reason},end)
  const entries = (active?.entries || []).map(entry => {
    const completed = {
      id: entry.id,
      sets: entry.sets,
      topW: entry.topW || null,
      target: entry.target || null,
    }
    const snapshot = typeof snapshotFor === 'function' ? snapshotFor(entry) : null
    if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) && Object.keys(snapshot).length) {
      completed.muscleSnapshot = { ...snapshot }
    }
    // What you typed about this exercise today, and whether you asked to see it again next
    // time. Written only when there is something to keep, so an untouched entry is byte-for-byte
    // the shape it always was.
    const note = (entry.note || '').trim()
    if (note) {
      completed.note = note
      if (entry.notePin) completed.notePin = true
    }
    return completed
  }).filter(entry => reason === 'inactivity' || entry.sets.some(set => set.done || set.leftDone || set.rightDone))

  const sessionNote = (active?.note || '').trim()

  return {
    id: active.id,
    d: active.d,
    start: active.start,
    end: timing.end,
    sessionStartedAt: timing.sessionStartedAt, lastActivityAt: timing.lastActivityAt, accumulatedActiveDuration: timing.accumulatedActiveDuration,
    sessionStatus: timing.sessionStatus, endedAt: timing.endedAt, finishReason: reason,
    ...(timing.pausedDurationMs ? { pausedDurationMs: timing.pausedDurationMs } : {}),
    routineId: active.routineId,
    name: active.name,
    bw: active.bw,
    ...(active.unit ? { unit: active.unit } : {}),
    ...(active.bwUnit ? { bwUnit: active.bwUnit } : {}),
    ...(active.deload ? { deload: true } : {}),
    entries,
    prs,
    ...(sessionNote ? { note: sessionNote } : {}),
  }
}
