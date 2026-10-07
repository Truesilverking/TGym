import { afterEach, describe, expect, it, vi } from 'vitest'
import { markRoutineComplete, reconcileWorkoutClock, reconcileWorkoutEdit } from './workout-lifecycle.js'
import { resumeWorkoutClock, workoutElapsedMs, correctWorkoutDuration } from './workout-time.js'
import { buildCompletedWorkout } from './finish-workout.js'
import { routineDurationSummary, sessionTimingSummary } from './stats-insights.js'
import { buildProgressReport } from './progress-report.js'
import { statsReportPages } from './stats-pdf.js'
import { workoutNotificationState } from './workout-notification.js'
import { createBackup, readBackup } from './backup.js'
import { fmtDur } from './format.js'

const minute=60000, start=Date.parse('2026-10-07T10:00:00-04:00')
const row={phase:'work',w:40,r:6,done:true,doneAt:start+5*minute}
const initial=()=>({id:'duration-parity',routineId:'routine-parity',sessionOrigin:{type:'planned',routineId:'routine-parity'},name:'Parity routine',d:'2026-10-07',start,lastUserInteractionAt:start,entries:[{id:'0025',target:{mode:'reps'},sets:[{...row,done:false}]}]})
const state=workouts=>({unit:'kg',lang:'en',routines:[{id:'routine-parity',name:'Parity routine',ex:[]}],workouts,week:{},dayPlan:{},bodyweight:[],measurements:[],inbody:[]})

function expectConsumers(workout,minutes,now){
 vi.useFakeTimers(); vi.setSystemTime(now)
 const S=state([workout]),before=structuredClone(S)
 expect(workoutElapsedMs(workout,now)).toBe(minutes*minute)
 expect(workout.accumulatedActiveDuration).toBe(minutes*minute)
 expect(routineDurationSummary(S.workouts,{routines:S.routines,now})[0]).toMatchObject({count:1,meanMs:minutes*minute,medianMs:minutes*minute})
 expect(sessionTimingSummary(S.workouts).averageMs).toBe(minutes*minute)
 expect(buildProgressReport(S,{now:new Date(now),period:'all'}).summary.totalMinutes).toBe(minutes)
 const pages=statsReportPages(S,{sections:['duration'],filters:{durationRange:0},now:new Date(now)})
 expect(pages.map(page=>page.svg).join('')).toContain('Average duration: '+fmtDur(minutes*minute))
 expect(readBackup(createBackup(S)).workouts).toEqual([workout])
 expect(S).toEqual(before)
}
afterEach(()=>vi.useRealTimers())

describe('one effective duration across persistence and reporting',()=>{
 it('excludes the Finish review, permits explicit continuation and additional session work',()=>{
  let active=markRoutineComplete({...initial(),entries:[{id:'0025',target:{mode:'reps'},sets:[row]}]},start+5*minute)
  expect(workoutNotificationState(active,null,start+25*minute)).toMatchObject({paused:true,elapsedMs:5*minute,autoPauseAt:0})
  active=resumeWorkoutClock(active,start+25*minute)
  expect(reconcileWorkoutClock(active,start+26*minute).timerPausedAt).toBeUndefined()
  const withExtra={...active,entries:[...active.entries,{id:'0027',target:{mode:'reps'},sets:[{...row,done:false}]}]}
  active=reconcileWorkoutEdit(active,withExtra,start+26*minute)
  const final={...active,entries:active.entries.map(entry=>({...entry,sets:entry.sets.map(set=>({...set,done:true,doneAt:start+35*minute}))}))}
  active=reconcileWorkoutEdit(active,final,start+35*minute)
  expect(workoutElapsedMs(active,start+40*minute)).toBe(15*minute)
  expectConsumers(buildCompletedWorkout(active,{end:start+40*minute}),15,start+40*minute)
 })
 it('uses the same 30-minute cutoff before and after reopen and keeps correction audit in history',()=>{
  const raw=initial(),paused=reconcileWorkoutClock(raw,start+90*minute)
  expect(workoutElapsedMs(raw,start+90*minute)).toBe(30*minute)
  expect(paused).toMatchObject({timerPausedAt:start+30*minute,pauseReason:'inactivity'})
  expect(workoutNotificationState(paused,null,start+90*minute)).toMatchObject({paused:true,elapsedMs:30*minute})
  const corrected=correctWorkoutDuration(paused,45,start+90*minute)
  const completed=buildCompletedWorkout({...corrected,entries:[{id:'0025',target:{mode:'reps'},sets:[row]}]},{end:start+90*minute})
  expect(completed).toMatchObject({originalTimerPausedAt:start+30*minute,originalDurationMs:30*minute,durationCorrectedAt:start+90*minute})
  expectConsumers(completed,45,start+90*minute)
  const existing=structuredClone(completed)
  reconcileWorkoutClock({...initial(),start:start+100*minute},start+200*minute)
  expect(completed).toEqual(existing)
 })
})
