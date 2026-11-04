import { it, expect } from 'vitest'
import { withBackoffRepsMode, refreshActiveBackoffReps, repBounds, applyTrainingPlan } from './training-plan.js'
import { cascadeTopBackReps } from './history.js'
import { createBackup, readBackup } from './backup.js'

it.each([[4,6],[6,8],[5,5]])('derives both bounds and three Back-offs for %s-%s', (min,max) => {
  const cfg={setScheme:'topback',reps:max,topRepsMin:min,topRepsMax:max,repRange:min!==max,backoffSets:3,backoffPct:10}
  for (const mode of ['same','increased']) {
    const offset=mode==='same'?0:2, target=withBackoffRepsMode(cfg,{backoffRepsMode:mode})
    expect(repBounds(target,'backoff')).toEqual({min:min+offset,max:max+offset})
    expect(applyTrainingPlan([{w:100,r:max}],target,2.5).filter(s=>s.role==='backoff').map(s=>[s.w,s.r])).toEqual(Array(3).fill([90,max+offset]))
    expect(cascadeTopBackReps([{role:'top',r:max},{role:'backoff',r:max+offset}],0,min,target)[1].r).toBe(min+offset)
  }
})
it('defaults to +2 and retains independent targets and unilateral storage semantics',()=>{
  expect(repBounds(withBackoffRepsMode({setScheme:'topback',reps:5}),'backoff')).toEqual({min:7,max:7})
  expect(repBounds(withBackoffRepsMode({setScheme:'topback',reps:5,autoBackoffReps:false,backoffRepsMin:10,backoffRepsMax:12},{backoffRepsMode:'same'}),'backoff')).toEqual({min:10,max:12})
  expect(repBounds(withBackoffRepsMode({setScheme:'topback',side:true,reps:10}),'backoff')).toEqual({min:14,max:14})
})
it('switches pending groups without rewriting completed/manual reps or loads',()=>{
  const active={entries:[{target:{setScheme:'topback',reps:6,topRepsMin:4,topRepsMax:6},sets:[{role:'top',r:5,done:true,w:100},{role:'backoff',r:7,done:true,w:90},{role:'backoff',r:11,manualFields:{r:true},w:85},{role:'backoff',r:7,leftDone:true,w:90},{role:'backoff',r:7,w:90},{role:'top',r:6,w:100},{role:'backoff',r:8,w:90}]}]}
  refreshActiveBackoffReps(active,{backoffRepsMode:'same'})
  expect(active.entries[0].sets.map(s=>s.r)).toEqual([5,7,11,7,5,6,6])
  refreshActiveBackoffReps(active,{backoffRepsMode:'increased'})
  expect(active.entries[0].sets.map(s=>s.r)).toEqual([5,7,11,7,7,6,8])
  expect(active.entries[0].sets.map(s=>s.w)).toEqual([100,90,85,90,90,100,90])
})
it('retains preference and history in portable backups',()=>{
  const state={backoffRepsMode:'same',routines:[],workouts:[{id:'saved',entries:[{sets:[{role:'backoff',r:7,done:true}]}]}]}
  expect(readBackup(createBackup(state))).toEqual(state)
})
