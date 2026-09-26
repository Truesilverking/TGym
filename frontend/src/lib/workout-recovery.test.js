import {describe,it,expect} from 'vitest'
import {workoutElapsedMs,pauseWorkoutClock,resumeWorkoutClock,sessionTiming,correctWorkoutDuration,recordWorkoutActivity} from './workout-time.js'
import {reconcileWorkoutEdit,ensureWorkoutCompletionPaused,workoutResolution} from './workout-lifecycle.js'
import {buildCompletedWorkout} from './finish-workout.js'
import {buildProgressReport} from './progress-report.js'
import {validTimedSessions} from './stats-insights.js'
import {workoutNotificationState} from './workout-notification.js'
const min=60000,start=new Date('2026-09-26T17:00:00').getTime()
const active=()=>({id:'a',d:'2026-09-26',start,entries:[{id:'0025',target:{mode:'reps'},sets:[{done:false,w:80,r:8},{done:false,w:80,r:8}]}]})
const serial=v=>JSON.parse(JSON.stringify(v))
const complete=()=>{const a=active(),b=structuredClone(a);b.entries[0].sets.forEach(s=>{s.done=true;s.doneAt=start+65*min});return reconcileWorkoutEdit(a,b,start+65*min)}
describe('requested workout recovery cases A–L',()=>{
 it('A: immediate finish preserves normal duration and completion evidence',()=>{
  const w=buildCompletedWorkout(complete(),{end:start+65*min})
  expect(w.end).toBe(start+65*min);expect(workoutElapsedMs(w)).toBe(65*min);expect(w.routineCompletedAt).toBe(w.end)
 })
 it('B: freezes immediately, waits ten minutes and ends at completion, only once',()=>{
  const a=serial(complete());expect(sessionTiming(a).sessionStatus).toBe('awaiting_finish')
  expect(workoutElapsedMs(a,start+74*min)).toBe(65*min);expect(workoutResolution(a,start+75*min-1)).toBeNull()
  const result=workoutResolution(a,start+75*min);expect(result).toEqual({reason:'auto_completed',end:start+65*min})
  const w=buildCompletedWorkout(a,result);expect(w.sessionStatus).toBe('auto_completed');expect(workoutElapsedMs(w)).toBe(65*min);expect(workoutResolution(w,start+500*min,true)).toBeNull()
 })
 it('C: Continue excludes all five waiting minutes and cancels completion deadline',()=>{
  const a=serial(resumeWorkoutClock(complete(),start+70*min));expect(a.routineCompletedAt).toBeUndefined()
  expect(workoutElapsedMs(a,start+71*min)).toBe(66*min);expect(workoutResolution(a,start+90*min)).toBeNull();expect(ensureWorkoutCompletionPaused(a)).toBe(a)
 })
 it.each([30,45,180])('D/E/I: pending work remains active for %s minutes without touch, including foreground restoration',minutes=>{
  const a=active();expect(workoutResolution(a,start+minutes*min,true)).toBeNull();expect(workoutResolution(a,start+minutes*min)).toBeNull()
  expect(workoutNotificationState(a,null,start+minutes*min).autoFinishAt).toBe(0)
 })
 it('F: explicit pause persists for hours and resumes accumulated duration',()=>{
  const a=serial({...pauseWorkoutClock(active(),start+10*min),pauseReason:'manual'})
  expect(workoutResolution(a,start+500*min,true)).toBeNull();expect(sessionTiming(a).sessionStatus).toBe('paused')
  expect(workoutElapsedMs(resumeWorkoutClock(a,start+70*min),start+71*min)).toBe(11*min)
 })
 it('G/K: completed restore hours later ends at original completion even if the pause field was missing',()=>{
  const a=serial(complete());delete a.timerPausedAt
  const repaired=ensureWorkoutCompletionPaused(a,start+240*min)
  expect(workoutResolution(repaired,start+240*min,true)).toEqual({reason:'auto_completed',end:start+65*min})
 })
 it('H/L: abandoned incomplete session resolves at 18:05 on 23:30 restore/new-workout, preserving pending rows',()=>{
  const a=recordWorkoutActivity(active(),start+65*min);a.entries[0].sets[0].done=true;a.entries[0].sets[0].doneAt=start+65*min
  const result=workoutResolution(serial(a),start+390*min,true);expect(result).toEqual({reason:'abandoned',end:start+65*min})
  const w=buildCompletedWorkout(a,result);expect(workoutElapsedMs(w)).toBe(65*min);expect(w.entries[0].sets).toHaveLength(2);expect(w.sessionStatus).toBe('abandoned')
  expect(workoutResolution(a,start+390*min,false)).toBeNull()
 })
 it('J: active/restored rest protects legitimate time and stale recovery includes its historical end',()=>{
  const a={...recordWorkoutActivity(active(),start+65*min),restTimer:{endsAt:start+70*min,total:300}}
  expect(workoutResolution(a,start+68*min,true)).toBeNull()
  expect(workoutResolution(serial(a),start+390*min,true).end).toBe(start+70*min)
  delete a.restTimer;a.lastRestEndedAt=start+70*min;expect(workoutResolution(a,start+390*min,true).end).toBe(start+70*min)
 })
 it('protects long running timed work, ignores settings/notes/polling and honours row completion timestamps',()=>{
  const a={...active(),workEndsAt:start+360*min,lastUserInteractionAt:start+300*min,lastActivityAt:start+300*min}
  expect(workoutResolution(a,start+300*min,true)).toBeNull()
  expect(reconcileWorkoutEdit(a,{...a,note:'settings'},start+300*min).lastMeaningfulTrainingActivityAt).toBeUndefined()
  expect(workoutResolution(a,start+601*min,true).end).toBe(start+360*min)
 })
 it('correction updates the shared duration for History, statistics and Progress Report without altering sets',()=>{
  const w=buildCompletedWorkout(complete(),{reason:'auto_completed',end:start+75*min})
  const corrected=correctWorkoutDuration(w,70,start+100*min)
  expect(corrected.originalEndedAt).toBe(start+65*min);expect(corrected.entries).toEqual(w.entries)
  expect(validTimedSessions([corrected],{now:start+100*min})[0].durationMs).toBe(70*min)
  expect(buildProgressReport({workouts:[corrected]},{now:new Date(start+100*min)}).summary.totalMinutes).toBe(70)
  expect(correctWorkoutDuration(w,101,start+100*min)).toBeNull();expect(correctWorkoutDuration(w,'',start+100*min)).toBeNull()
 })
 it('ignores later notes and rest when already complete, and handles multiple continuation segments',()=>{
  let a=complete();a.restTimer={endsAt:start+90*min,total:1500}
  expect(workoutResolution(a,start+90*min,true).end).toBe(start+65*min)
  a=resumeWorkoutClock(a,start+70*min);const b=structuredClone(a);b.entries[0].sets.push({done:false,w:80,r:8})
  const c=reconcileWorkoutEdit(a,b,start+72*min);const d=structuredClone(c);d.entries[0].sets[2].done=true;d.entries[0].sets[2].doneAt=start+80*min
  const done=reconcileWorkoutEdit(c,d,start+80*min);expect(workoutElapsedMs(done,start+120*min)).toBe(75*min)
 })
})
