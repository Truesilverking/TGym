import {createBackup,readBackup} from './backup.js'
import {migrateState} from './state-migrations.js'
import {describe,it,expect} from 'vitest'
import {inactivityState,inactivityDeadline,recordWorkoutActivity,pauseWorkoutClock,resumeWorkoutClock,sessionTiming,workoutElapsedMs} from './workout-time.js'
import {reconcileWorkoutEdit,resumeAutoFinished,ensureWorkoutCompletionPaused} from './workout-lifecycle.js'
import {buildCompletedWorkout} from './finish-workout.js'
import {toggleSetSide} from './workout-model.js'
import {workoutVolume,sideReps,repStep} from './history.js'
const min=60000
const active=()=>({id:'w',start:18*60*min,d:'2026-09-24',entries:[{id:'row',target:{side:true,repsPerSide:true,reps:10},sets:[{r:10,w:20,done:false},{r:10,w:20,done:false}]}]})
const serial=x=>JSON.parse(JSON.stringify(x))
describe('timestamp session contract across suspend/refresh/update',()=>{
 it.each(['refresh','background','offline','device restart','PWA update'])('%s restores the exact deadline with unfinished progress',()=>{
  const a=active();a.entries[0].sets[0]=toggleSetSide(a.entries[0].sets[0],'left')
  const saved=serial(recordWorkoutActivity(a,18*60*min+10*min))
  expect(inactivityState(saved,18*60*min+39*min)).toBe('warning')
  expect(inactivityState(saved,22*60*min)).toBe('finish')
  const w=buildCompletedWorkout(saved,{end:inactivityDeadline(saved),reason:'inactivity'})
  expect(w.end).toBe((18*60+40)*min)
  expect(w.sessionStatus).toBe('ended_by_inactivity')
  expect(w.accumulatedActiveDuration).toBe(40*min)
  expect(w.entries[0].sets).toEqual(a.entries[0].sets)
  expect(w.lastActivityAt).toBe((18*60+10)*min)
 })
 it('freezes completion, continues accumulated time and never revives an ended record',()=>{
  const a=active(), end=a.start+10*min
  a.entries[0].sets.forEach(s=>{s.done=true;s.doneAt=end})
  const paused=serial(sessionTiming(ensureWorkoutCompletionPaused(a,end),end))
  expect(paused.sessionStatus).toBe('paused')
  expect(workoutElapsedMs(paused,end+120*min)).toBe(10*min)
  const resumed=resumeWorkoutClock(paused,end+120*min)
  expect(workoutElapsedMs(resumed,end+121*min)).toBe(11*min)
  const finished=buildCompletedWorkout(resumed,{end:end+121*min})
  expect(resumeWorkoutClock(finished,end+150*min)).toBe(finished)
 })
 it('tracks navigation and notes while timer/render/sync updates never count',()=>{
  const a=active(),now=a.start+min
  for(const after of [{...a,cur:1},{...a,note:'New note'}]) expect(reconcileWorkoutEdit(a,after,now).lastActivityAt).toBe(now)
  expect(reconcileWorkoutEdit(a,{...a,workEndsAt:now+100*min},now).lastActivityAt).toBeUndefined()
  const next=structuredClone(a);next.entries[0].sets[0].r=12
  expect(reconcileWorkoutEdit(a,next,now,false).lastActivityAt).toBeUndefined()
  expect(recordWorkoutActivity(a,a.start+31*min)).toBe(a)
 })
 it('a new explicit continuation preserves historical identity, duration and all completed sets',()=>{
  const a=active();a.entries[0].sets[0].done=true
  const old={...buildCompletedWorkout(a,{end:a.start+30*min,reason:'inactivity'}),resumeSnapshot:a}
  const state={active:null,workouts:[old]}
  resumeAutoFinished(state,old.id,a.start+60*min)
  expect(state.workouts[0]).toEqual(old)
  expect(state.active.id).not.toBe(old.id)
  expect(state.active.entries[0].sets.every(s=>!s.done)).toBe(true)
  expect(workoutElapsedMs(state.active,a.start+61*min)).toBe(min)
 })
})
it('per-side confirmation counts one set and does not double reps or volume',()=>{
 const a=active(),row=a.entries[0].sets[0]
 const left=toggleSetSide(row,'left'),both=toggleSetSide(left,'right')
 expect(left.done).toBe(false);expect(both.done).toBe(true);expect(both.r).toBe(10)
 expect(workoutVolume({entries:[{sets:[both]}]})).toBe(200)
 expect(toggleSetSide(serial(both),'left')).toMatchObject({r:10,leftDone:false,rightDone:true,done:false})
 expect(sideReps(10,{repsPerSide:true})).toBe(10)
 expect(sideReps(20,{side:true})).toBe(10)
 expect(repStep({side:true,repsPerSide:true})).toBe(1)
})

it('backup and additive migration preserve paused time, partial sides and historical records',()=>{
 const a=active();a.entries[0].sets[0]=toggleSetSide(a.entries[0].sets[0],'left')
 const paused=sessionTiming(pauseWorkoutClock(a,a.start+10*min),a.start+10*min)
 const state={storageVersion:2,routines:[],workouts:[{id:'older',start:10,end:20,entries:[]}],active:paused}
 const restored=migrateState(readBackup(serial(createBackup(state))))
 expect(restored.active).toEqual(paused)
 expect(workoutElapsedMs(restored.active,a.start+240*min)).toBe(10*min)
 expect(restored.workouts).toEqual(state.workouts)
})
