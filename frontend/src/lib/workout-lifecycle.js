import { isWarmupRow } from './workout-model.js'
import { uid, isoOf } from './format.js'
import { pauseWorkoutClock, resumeWorkoutClock, sessionTiming, recordWorkoutActivity, inactivityState, lastTrainingBoundary, STALE_SESSION_MS } from './workout-time.js'

export function effectiveWorkoutComplete(active) {
  const rows = (active?.entries || []).flatMap(e=>e.sets || []).filter(s=>!isWarmupRow(s))
  return rows.length > 0 && rows.every(s=>s.done)
}
// Repair at restore/background boundaries using recorded activity, never time away.
// Explicit Continue remains running until another completion or stale recovery.
export function ensureWorkoutCompletionPaused(active, now=Date.now()) {
  if (!active || active.end != null || active.pauseReason === 'manual' || active.timerContinuedAt != null || !effectiveWorkoutComplete(active)) return active
  if (active.routineCompletedAt != null && active.timerPausedAt != null) return active
  const timestamps = (active.entries || []).flatMap(e=>e.sets || []).filter(s=>!isWarmupRow(s) && s.done).map(s=>s.doneAt)
  const start = Number(active.start) || 0
  const recorded = [active.routineCompletedAt, active.timerPausedAt, active.completedAt, ...timestamps, active.lastMeaningfulTrainingActivityAt ?? active.lastMeaningfulWorkoutActivityAt].filter(v=>v != null && Number.isFinite(Number(v)) && Number(v)>=start && Number(v)<=now)
  const at = recorded.length ? Math.max(start, ...recorded.map(Number)) : start
  return markRoutineComplete(active, Math.min(now, at))
}
const activitySignature = active => JSON.stringify({cur:active?.cur,entries:(active?.entries || []).map(e=>({id:e.id,sets:(e.sets || []).map(s=>({w:s.w,r:s.r,rir:s.rir,rpe:s.rpe,sec:s.sec,leftSec:s.leftSec,rightSec:s.rightSec,leftDone:s.leftDone,rightDone:s.rightDone,min:s.min,speed:s.speed,done:s.done,phase:s.phase,role:s.role,drops:s.drops,clusters:s.clusters,bursts:s.bursts}))}))})
// Training edits and exercise navigation count; notes and automatic writes do not.
export function reconcileWorkoutEdit(before, after, now=Date.now(), userActivity=true) {
  if (!after || after.end != null) return after
  if (!before || before.id !== after.id) return recordWorkoutActivity(after,after.lastMeaningfulTrainingActivityAt ?? after.lastMeaningfulWorkoutActivityAt ?? now)
  if (activitySignature(before) === activitySignature(after)) return after
  let next = userActivity ? recordWorkoutActivity(after,now) : {...after}
  if(userActivity && before.pauseReason==='manual')next=resumeWorkoutClock(next,now)
  const addedExercise=(after.entries || []).length>(before.entries || []).length
  if (effectiveWorkoutComplete(before) && (!effectiveWorkoutComplete(after) || addedExercise)) next=resumeWorkoutClock(next,now)
  if (!effectiveWorkoutComplete(before) && effectiveWorkoutComplete(after)) next=markRoutineComplete(next,userActivity ? now : Math.min(now,Math.max(Number(next.start)||0,...next.entries.flatMap(e=>e.sets||[]).map(s=>Number(s.doneAt)||0))))
  return next
}
export function resumeAutoFinished(state, id, now=Date.now()) {
  if (state.active) return false
  const w=state.workouts.find(w=>w.id===id && ['inactivity','abandoned','auto_completed'].includes(w.finishReason) && w.resumeSnapshot)
  if (!w) return false
  // Explicit continuation creates a new identity; the previous historical session is immutable.
  const snapshot = structuredClone(w.resumeSnapshot)
  for (const key of ['end','endedAt','timerPausedAt','timerContinuedAt','completedAt','pausedDurationMs','finishReason','workEndsAt','restTimer','routineCompletedAt','pauseReason','lastRestEndedAt','lastWorkEndedAt','lastMeaningfulTrainingActivityAt','manualFinishedAt','durationCorrectedAt','originalEndedAt']) delete snapshot[key]
  snapshot.entries = snapshot.entries.map(e => ({...e, asked:false, sets:e.sets.map(row => {
    const next = {...row,done:false}
    for(const key of ['doneAt','leftDone','rightDone','leftSec','rightSec']) delete next[key]
    return next
  })}))
  state.active=sessionTiming({...snapshot,id:uid(),d:isoOf(new Date(now)),start:now,lastActivityAt:now,lastMeaningfulWorkoutActivityAt:now,continuedFrom:w.id,cur:0},now)
  return true
}

export function markRoutineComplete(active, at=Date.now()) {
  if (!active || active.end != null) return active
  const next=pauseWorkoutClock(active,at)
  return {...next,routineCompletedAt:next.routineCompletedAt ?? next.timerPausedAt ?? at,pauseReason:'completion'}
}
// Stale recovery is evaluated at restoration/foreground/new-session boundaries,
// never by a running idle interval. Four hours beyond real work/rest is conservative.
export function workoutResolution(active, now=Date.now(), recoverStale=false) {
  if (!active || active.end != null) return null
  const repaired=ensureWorkoutCompletionPaused(active,now)
  if(inactivityState(repaired,now)==='finish')return {reason:'auto_completed',end:repaired.routineCompletedAt}
  if(!recoverStale || repaired.timerPausedAt!=null || repaired.routineCompletedAt!=null) return null
  if(Number(repaired.workEndsAt)>now || Number(repaired.restTimer?.endsAt)>now)return null
  const end=lastTrainingBoundary(repaired,now)
  return now-end>=STALE_SESSION_MS ? {reason:'abandoned',end} : null
}
