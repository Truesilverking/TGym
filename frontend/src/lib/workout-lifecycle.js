import { isWarmupRow } from './workout-model.js'
import { pauseWorkoutClock, resumeWorkoutClock } from './workout-time.js'

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
const activitySignature = active => JSON.stringify((active?.entries || []).map(e=>({id:e.id,sets:(e.sets || []).map(s=>({w:s.w,r:s.r,rir:s.rir,rpe:s.rpe,sec:s.sec,leftSec:s.leftSec,rightSec:s.rightSec,min:s.min,speed:s.speed,done:s.done,phase:s.phase,role:s.role,drops:s.drops,clusters:s.clusters,bursts:s.bursts}))})))
// Called at the existing persistence boundary: navigation/preferences are excluded.
export function reconcileWorkoutEdit(before, after, now=Date.now()) {
  if (!after || after.end != null) return after
  if (!before || before.id !== after.id) return {...after,lastMeaningfulWorkoutActivityAt:after.lastMeaningfulWorkoutActivityAt ?? now}
  if (activitySignature(before) === activitySignature(after)) return after
  let next = {...after,lastMeaningfulWorkoutActivityAt:now}
  const addedExercise=(after.entries || []).length>(before.entries || []).length
  if (effectiveWorkoutComplete(before) && (!effectiveWorkoutComplete(after) || addedExercise)) next=resumeWorkoutClock(next,now)
  if (!effectiveWorkoutComplete(before) && effectiveWorkoutComplete(after)) next=pauseWorkoutClock(next,now)
  return next
}
export function resumeAutoFinished(state, id, now=Date.now()) {
  if (state.active) return false
  const w=state.workouts.find(w=>w.id===id && w.finishReason==='inactivity' && w.resumeSnapshot)
  if (!w) return false
  state.active=resumeWorkoutClock({...w.resumeSnapshot,timerPausedAt:w.end},now)
  delete state.active.end
  state.workouts=state.workouts.filter(row=>row.id!==id)
  return true
}
