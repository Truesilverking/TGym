import {describe,it,expect} from 'vitest'
import {createStatsSnapshotSelector} from './stats-snapshot.js'
import {migrateState} from './state-migrations.js'
import {recordWorkoutInteraction,sessionTiming} from './workout-time.js'

const state = () => migrateState({workouts:[{id:'saved',entries:[]}],routines:[{id:'r',ex:[]}],week:{1:['r']},dayPlan:{},routineOrder:['r'],statsSections:['history'],active:{id:'live',start:1000,entries:[],lastUserInteractionAt:1000}}, {cloneInput:false})
describe('Stats input-only clock snapshot',()=>{
  it('retains charts after a normalized input write without suppressing the real clock state',()=>{
    const select=createStatsSnapshotSelector(), first=state()
    first.active=sessionTiming(first.active,1000)
    expect(select(first)).toBe(first)
    const next=migrateState({...first,_ts:2000,active:recordWorkoutInteraction(first.active,2000)},{cloneInput:false})
    expect(next.active.lastUserInteractionAt).toBe(2000)
    expect(next.week).toBe(first.week)
    expect(next.dayPlan).toBe(first.dayPlan)
    expect(next.routineOrder).toBe(first.routineOrder)
    expect(select(next)).toBe(first)
  })
  it.each([
    s=>({...s,active:{...s.active,timerPausedAt:2000,pauseReason:'inactivity'}}),
    s=>({...s,active:{...s.active,entries:[{id:'exercise',sets:[{done:true}]}]}}),
    s=>({...s,active:{...s.active,durationCorrectedAt:2000}}),
    s=>({...s,active:null}),
    s=>({...s,statsSections:['measurements']}),
    s=>({...s,profile:{name:'local'}}),
    s=>({...s,workouts:[...s.workouts,{id:'new'}]}),
    s=>({...s,unit:'lb'}),
    s=>({...s,week:{1:[]}}),
  ])('observes real training, history and preference changes %#',change=>{
    const select=createStatsSnapshotSelector(), first=state(), next=change(first)
    select(first)
    expect(select(next)).toBe(next)
    expect(select(next)).toBe(next)
  })
})
