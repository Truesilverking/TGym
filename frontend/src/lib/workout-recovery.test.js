import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest'
import {workoutElapsedMs,pauseWorkoutClock,resumeWorkoutClock,sessionTiming,correctWorkoutDuration,recordWorkoutActivity,recordWorkoutInteraction,inactivityDeadline} from './workout-time.js'
import {reconcileWorkoutEdit,ensureWorkoutCompletionPaused,workoutResolution,reconcileWorkoutClock} from './workout-lifecycle.js'
import {buildCompletedWorkout} from './finish-workout.js'
import {buildProgressReport} from './progress-report.js'
import {validTimedSessions,routineDurationSummary} from './stats-insights.js'
import {workoutNotificationState} from './workout-notification.js'
const min=60000,start=new Date('2026-09-26T17:00:00').getTime()
const active=()=>({id:'a',routineId:'r',d:'2026-09-26',start,lastUserInteractionAt:start,entries:[{id:'0025',target:{mode:'reps'},sets:[{done:false,w:80,r:8},{done:false,w:80,r:8}]}]})
const serial=v=>JSON.parse(JSON.stringify(v))
const at=minutes=>vi.setSystemTime(start+minutes*min)
const complete=()=>{const a=active(),b=structuredClone(a);b.entries[0].sets.forEach(s=>{s.done=true;s.doneAt=start+65*min});return reconcileWorkoutEdit(a,b,start+65*min)}
describe('controlled clock, Finish/Continue and suspended recovery',()=>{
 beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(start)})
 afterEach(()=>{vi.clearAllTimers();vi.useRealTimers()})
 it('Finish → wait → Continue → additional exercise → Finish counts only active periods',()=>{
  let a=serial(complete());at(125)
  expect(sessionTiming(a).sessionStatus).toBe('awaiting_finish')
  expect(workoutElapsedMs(a)).toBe(65*min)
  expect(workoutResolution(a)).toBeNull()
  a=resumeWorkoutClock(a);expect(ensureWorkoutCompletionPaused(a)).toBe(a)
  at(126);const b=structuredClone(a);b.entries.push({id:'0026',sets:[{done:false,w:20,r:8}]})
  a=reconcileWorkoutEdit(a,b)
  at(135);const c=structuredClone(a);Object.assign(c.entries[1].sets[0],{done:true,doneAt:Date.now()})
  a=reconcileWorkoutEdit(a,c)
  at(180);const w=buildCompletedWorkout(a)
  expect(workoutElapsedMs(w)).toBe(75*min)
  expect(w.end).toBe(start+135*min)
  expect(w.pausedDurationMs).toBe(60*min)
  expect(w.entries).toHaveLength(2)
  expect(resumeWorkoutClock(w)).toBe(w)
 })
 it('manual pause survives repeated calls, serialization and edits until explicit resume',()=>{
  at(10);let a=pauseWorkoutClock(active(),Date.now(),'manual')
  at(100);expect(pauseWorkoutClock(a)).toBe(a);a=serial(a)
  const edited=structuredClone(a);edited.entries[0].sets[0].r=12
  a=reconcileWorkoutEdit(a,edited)
  expect(a.pauseReason).toBe('manual');expect(workoutElapsedMs(a)).toBe(10*min)
  expect(workoutResolution(a)).toBeNull()
  const resumed=resumeWorkoutClock(a);expect(resumeWorkoutClock(resumed)).toBe(resumed)
  at(101);expect(workoutElapsedMs(resumed)).toBe(11*min)
  expect(resumed.pausedDurationMs).toBe(90*min)
 })
 it.each([29.999,30,30.001,240])('uses the exact deadline before/at/after thirty minutes (%s)',minutes=>{
  at(minutes);const a=active(),r=reconcileWorkoutClock(a)
  if(minutes<30){expect(r).toBe(a);expect(workoutElapsedMs(r)).toBeCloseTo(minutes*min)}
  else {expect(r).toMatchObject({timerPausedAt:start+30*min,pauseReason:'inactivity'});expect(workoutElapsedMs(r)).toBe(30*min);expect(r.end).toBeUndefined()}
 })
 it.each(['screen lock','app switch','process restart','offline reload','PWA update'])('%s retains progress, freezes at last input +30m and never automatically resumes',()=>{
  at(10);const a=recordWorkoutActivity(active());a.entries[0].sets[0].done=true;a.entries[0].sets[0].doneAt=Date.now()
  at(39);expect(workoutResolution(a)).toBeNull();expect(workoutElapsedMs(a)).toBe(39*min)
  at(300);let restored=sessionTiming(reconcileWorkoutClock(serial(a)))
  expect(restored.id).toBe(a.id);expect(restored.entries).toEqual(a.entries)
  expect(restored).toMatchObject({sessionStatus:'paused',pauseReason:'inactivity',timerPausedAt:start+40*min,accumulatedActiveDuration:40*min})
  restored=recordWorkoutInteraction(restored)
  expect(workoutElapsedMs(restored)).toBe(40*min);expect(restored.timerPausedAt).toBe(start+40*min)
  const continued=resumeWorkoutClock(restored);at(301)
  expect(workoutElapsedMs(continued)).toBe(41*min);expect(continued.id).toBe(a.id)
 })
 it('normal rest counts but renders, rest/work deadlines and autonomous callbacks do not extend input',()=>{
  at(10);const a={...recordWorkoutActivity(active()),restTimer:{endsAt:start+15*min,total:300},workEndsAt:start+100*min}
  at(15);expect(workoutElapsedMs(a)).toBe(15*min)
  at(50);const b=structuredClone(a);b.entries[0].sets.forEach(s=>{s.done=true;s.doneAt=start+45*min})
  const repaired=reconcileWorkoutEdit(a,b,Date.now(),false)
  expect(repaired).toMatchObject({timerPausedAt:start+40*min,pauseReason:'inactivity',lastUserInteractionAt:start+10*min})
  expect(workoutElapsedMs(repaired)).toBe(40*min)
  expect(workoutNotificationState(a,null)).toMatchObject({active:true,paused:true,pauseReason:'inactivity',elapsedMs:40*min,autoPauseAt:0})
 })
 it('any real TGym interaction extends the deadline without inventing training row edits',()=>{
  at(29);const a=recordWorkoutInteraction(active())
  expect(a.lastMeaningfulTrainingActivityAt).toBeUndefined()
  expect(inactivityDeadline(a)).toBe(start+59*min)
  at(40);expect(workoutResolution(a)).toBeNull()
  at(59);expect(workoutResolution(a)).toEqual({reason:'inactivity',pauseAt:start+59*min})
 })
 it('restores legacy completed work at its recorded completion time without creating history',()=>{
  const a=serial(complete());delete a.timerPausedAt;at(240)
  const repaired=ensureWorkoutCompletionPaused(a)
  expect(repaired.timerPausedAt).toBe(start+65*min)
  expect(workoutResolution(repaired)).toBeNull()
  expect(workoutElapsedMs(buildCompletedWorkout(repaired))).toBe(65*min)
 })
 it('active correction carries an audit and one effective duration into history, routine averages and Progress',()=>{
  at(100);const a=reconcileWorkoutClock(active())
  const corrected=correctWorkoutDuration(a,70)
  expect(corrected).toMatchObject({originalTimerPausedAt:start+30*min,originalDurationMs:30*min,durationCorrectedAt:Date.now(),pauseReason:'inactivity'})
  expect(workoutElapsedMs(corrected)).toBe(70*min)
  expect(corrected.entries).toEqual(a.entries)
  expect(correctWorkoutDuration(a,101)).toBeNull();expect(correctWorkoutDuration(a,'')).toBeNull()
  const w=buildCompletedWorkout(corrected)
  expect(w.durationCorrectedAt).toBe(corrected.durationCorrectedAt)
  expect(w.originalDurationMs).toBe(30*min)
  expect(validTimedSessions([w])[0].durationMs).toBe(70*min)
  expect(routineDurationSummary([w],{routines:[{id:'r',name:'Routine'}],now:Date.now()})[0].meanMs).toBe(70*min)
  expect(buildProgressReport({workouts:[w]},{now:new Date()}).summary.totalMinutes).toBe(70)
  const again=correctWorkoutDuration(w,75)
  expect(workoutElapsedMs(again)).toBe(75*min)
  expect(again.originalEndedAt).toBe(w.end)
 })
 it('legacy history duration remains unchanged, and invalid clocks cannot accumulate negative time',()=>{
  const historical={start,end:start+300*min,pausedDurationMs:10*min}
  at(500);expect(workoutElapsedMs(historical)).toBe(290*min)
  expect(workoutElapsedMs({...active(),start:Date.now()+min})).toBe(0)
  expect(workoutElapsedMs({...active(),pausedDurationMs:999*min})).toBe(0)
 })
 it('saving directly after suspension matches the duration displayed before reconciliation',()=>{
  at(100);const a=active()
  const shown=workoutElapsedMs(a)
  const w=buildCompletedWorkout(a)
  expect(workoutElapsedMs(w)).toBe(shown)
  expect(w).toMatchObject({end:start+30*min,pauseReason:'inactivity',accumulatedActiveDuration:30*min})
 })
 it('future or invalid input timestamps cannot postpone the thirty-minute deadline',()=>{
  at(100)
  for(const lastUserInteractionAt of [start+500*min,'invalid',-1]) {
    const a={...active(),lastUserInteractionAt}
    expect(reconcileWorkoutClock(a).timerPausedAt).toBe(start+30*min)
    expect(workoutElapsedMs(a)).toBe(30*min)
  }
 })
})
