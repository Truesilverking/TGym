import { isWarmupRow } from './workout-model.js'
import { uid, isoOf } from './format.js'
import { pauseWorkoutClock, resumeWorkoutClock, sessionTiming } from './workout-time.js'

export function effectiveWorkoutComplete(active) {
  const rows = (active?.entries || []).flatMap(e=>e.sets || []).filter(s=>!isWarmupRow(s))
  return rows.length > 0 && rows.every(s=>s.done)
}
// Repair at restore/background boundaries using recorded activity, never time away.
// Explicit Continue remains running until another completion transition or inactivity.
export function ensureWorkoutCompletionPaused(active, now=Date.now()) {
  if (!active || active.end != null || active.timerPausedAt != null || active.timerContinuedAt != null || !effectiveWorkoutComplete(active)) return active
  const timestamps = (active.entries || []).flatMap(e=>e.sets || []).filter(s=>!isWarmupRow(s) && s.done).map(s=>s.doneAt)
  const recorded = [active.completedAt, ...timestamps, active.lastMeaningfulWorkoutActivityAt].filter(v=>v != null && Number.isFinite(Number(v)))
  const start = Number(active.start) || 0
  const at = recorded.length ? Math.max(start, ...recorded.map(Number)) : start
  return pauseWorkoutClock(active, Math.min(now, at))
}
const activitySignature = active => JSON.stringify({cur:active?.cur,note:active?.note,entries:(active?.entries || []).map(e=>({id:e.id,note:e.note,sets:(e.sets || []).map(s=>({w:s.w,r:s.r,rir:s.rir,rpe:s.rpe,sec:s.sec,leftSec:s.leftSec,rightSec:s.rightSec,leftDone:s.leftDone,rightDone:s.rightDone,min:s.min,speed:s.speed,done:s.done,phase:s.phase,role:s.role,drops:s.drops,clusters:s.clusters,bursts:s.bursts}))}))})
// User edits, notes and exercise navigation count; callers exclude automatic timer writes.
export function reconcileWorkoutEdit(before, after, now=Date.now(), userActivity=true) {
  if (!after || after.end != null) return after
  if (!before || before.id !== after.id) return {...after,lastMeaningfulWorkoutActivityAt:after.lastMeaningfulWorkoutActivityAt ?? now}
  if (activitySignature(before) === activitySignature(after)) return after
  let next = userActivity ? {...after,lastMeaningfulWorkoutActivityAt:now,lastActivityAt:now} : {...after}
  const addedExercise=(after.entries || []).length>(before.entries || []).length
  if (effectiveWorkoutComplete(before) && (!effectiveWorkoutComplete(after) || addedExercise)) next=resumeWorkoutClock(next,now)
  if (!effectiveWorkoutComplete(before) && effectiveWorkoutComplete(after)) next=pauseWorkoutClock(next,userActivity ? now : Math.min(now,Math.max(Number(next.start)||0,...next.entries.flatMap(e=>e.sets||[]).map(s=>Number(s.doneAt)||0))))
  return next
}
export function resumeAutoFinished(state, id, now=Date.now()) {
  if (state.active) return false
  const w=state.workouts.find(w=>w.id===id && w.finishReason==='inactivity' && w.resumeSnapshot)
  if (!w) return false
  // Explicit continuation creates a new identity; the previous historical session is immutable.
  const snapshot = structuredClone(w.resumeSnapshot)
  for (const key of ['end','endedAt','timerPausedAt','timerContinuedAt','completedAt','pausedDurationMs','finishReason','workEndsAt']) delete snapshot[key]
  snapshot.entries = snapshot.entries.map(e => ({...e, asked:false, sets:e.sets.map(row => {
    const next = {...row,done:false}
    for(const key of ['doneAt','leftDone','rightDone','leftSec','rightSec']) delete next[key]
    return next
  })}))
  state.active=sessionTiming({...snapshot,id:uid(),d:isoOf(new Date(now)),start:now,lastActivityAt:now,lastMeaningfulWorkoutActivityAt:now,continuedFrom:w.id,cur:0},now)
  return true
}
