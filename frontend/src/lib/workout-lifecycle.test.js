import {describe,it,expect} from 'vitest'
import {effectiveWorkoutComplete,reconcileWorkoutEdit,resumeAutoFinished} from './workout-lifecycle.js'
import {inactivityState,lastWorkoutActivity,pauseWorkoutClock,workoutElapsedMs} from './workout-time.js'
const min=60000
const active=()=>({id:'session',start:0,entries:[{id:'ex',sets:[{w:20,r:5,done:false}]}]})
describe('persistent workout activity lifecycle',()=>{
  it('freezes final effective work regardless of unchecked warmups',()=>{
    const before=active(); before.entries[0].sets.unshift({phase:'warmup',done:false})
    const after=structuredClone(before); after.entries[0].sets[1].done=true
    const frozen=reconcileWorkoutEdit(before,after,10*min)
    expect(effectiveWorkoutComplete(frozen)).toBe(true)
    expect(workoutElapsedMs(frozen,50*min)).toBe(10*min)
  })
  it.each(['exercise','set','uncheck'])('%s resumes completed sessions excluding decision time',action=>{
    const before=pauseWorkoutClock(active(),10*min); before.entries[0].sets[0].done=true
    const after=structuredClone(before)
    if(action==='exercise') after.entries.push({id:'other',sets:[{done:false}]})
    if(action==='set') after.entries[0].sets.push({done:false})
    if(action==='uncheck') after.entries[0].sets[0].done=false
    const resumed=reconcileWorkoutEdit(before,after,30*min)
    expect(resumed.timerPausedAt).toBeUndefined()
    expect(workoutElapsedMs(resumed,31*min)).toBe(11*min)
  })
  it('warns at 20 and finishes at 30 using the last actual activity',()=>{
    const a={...active(),lastMeaningfulWorkoutActivityAt:10*min}
    expect(inactivityState(a,29*min)).toBe('none')
    expect(inactivityState(a,30*min)).toBe('warning')
    expect(inactivityState(a,40*min)).toBe('finish')
    expect(lastWorkoutActivity(a)).toBe(10*min)
    expect(inactivityState(JSON.parse(JSON.stringify(a)),55*min)).toBe('finish')
  })
  it('resets after edits at minute 19 but not navigation, preferences or rest',()=>{
    const before=active(), after=structuredClone(before);after.entries[0].sets[0].rir=2
    const next=reconcileWorkoutEdit(before,after,19*min)
    expect(inactivityState(next,30*min)).toBe('none')
    expect(reconcileWorkoutEdit(next,{...next,cur:1,restEndsAt:40*min},35*min).lastMeaningfulWorkoutActivityAt).toBe(19*min)
  })
  it('suppresses inactivity during explicitly timed work and starts grace at its end',()=>{
    const a={...active(),workEndsAt:60*min}
    expect(inactivityState(a,45*min)).toBe('none')
    expect(inactivityState(a,80*min)).toBe('warning')
  })
  it('resumes an auto-saved session with the same ID once and removes the history duplicate',()=>{
    const snapshot=active(),state={active:null,workouts:[{id:snapshot.id,end:10*min,finishReason:'inactivity',resumeSnapshot:snapshot}]}
    expect(resumeAutoFinished(state,snapshot.id,50*min)).toBe(true)
    expect(state.active.id).toBe(snapshot.id)
    expect(workoutElapsedMs(state.active,51*min)).toBe(11*min)
    expect(state.workouts).toEqual([])
    expect(resumeAutoFinished(state,snapshot.id,52*min)).toBe(false)
  })
  it('does not mistake a warmup-only plan for completion and handles legacy starts',()=>{
    expect(effectiveWorkoutComplete({entries:[{sets:[{phase:'warmup',done:true}]}]})).toBe(false)
    expect(inactivityState(active(),30*min)).toBe('finish')
  })
})
