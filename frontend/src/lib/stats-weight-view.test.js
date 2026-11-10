import {it,expect} from 'vitest'
import {statsWeightView} from './stats-weight-view.js'
import {statisticsState} from './training-history.js'
import {bestWeightForEntry} from './history.js'
import {e1rmSeries} from './onerm.js'
import {bmiFor} from './stats-insights.js'
import {LB_PER_KG} from './weight-units.js'

const deepFreeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(deepFreeze)}return value}
it('projects the reproduced 80-lb result into the kg Stats label and 1RM without changing history',()=>{
  const S={unit:'kg',trainingStartDate:'2026-10-01',workouts:[{id:'lb-session',unit:'lb',d:'2026-11-02',start:1000,entries:[{id:'lift',target:{mode:'reps'},sets:[{w:80,r:10,done:true}]}]}],bodyweight:[]}
  const before=structuredClone(S);deepFreeze(S)
  const view=statsWeightView(statisticsState(S,'2026-11-03'))
  expect(bestWeightForEntry(view.workouts[0].entries[0])).toBeCloseTo(80/LB_PER_KG,12)
  expect(e1rmSeries(view,'lift')[0].y).toBe(48.4)
  expect(e1rmSeries(S,'lift')[0].y).toBe(106.7)
  expect(view.workouts[0].unit).toBe('kg');expect(S).toEqual(before)
})
it('keeps references and byte representation when all masses already use the display unit',()=>{
  const S={unit:'lb',workouts:[{unit:'lb',vol:1200,bw:187.12345678,bwUnit:'lb',entries:[{unit:'lb',topW:80.12345678,target:{unit:'lb',weight:80.12345678},sets:[{unit:'lb',w:80.12345678,r:8,done:true,drops:[{w:60.12345678,unit:'lb'}]}]}]}],bodyweight:[{unit:'lb',w:187.12345678,samples:[{w:187.12345678}]}]}
  const bytes=JSON.stringify(S)
  expect(statsWeightView(S)).toBe(S);expect(JSON.stringify(S)).toBe(bytes)
})
it('honors entry, result and drop overrides independently and copies only affected branches',()=>{
  const matching={unit:'kg',w:'22.123456789',r:7,done:true},sameDrop={unit:'kg',w:12.12345678,r:4}
  const S={unit:'kg',workouts:[{unit:'lb',vol:1000,entries:[{unit:'kg',topW:50.12345678,target:{unit:'lb',weight:80.12345678,loadingStep:5,inc:2.5},sets:[matching,{unit:'lb',w:80.12345678,r:8,done:true,drops:[sameDrop,{w:40.12345678,r:4}]}]}]}],bodyweight:[]}
  const before=structuredClone(S),view=statsWeightView(S),entry=view.workouts[0].entries[0]
  expect(entry.topW).toBe(50.12345678);expect(entry.target.weight).toBeCloseTo(80.12345678/LB_PER_KG,12)
  expect(entry.target.loadingStep).toBeCloseTo(5/LB_PER_KG,12);expect(entry.target.inc).toBeCloseTo(2.5/LB_PER_KG,12)
  expect(entry.sets[0]).toBe(matching);expect(entry.sets[1].w).toBeCloseTo(80.12345678/LB_PER_KG,12)
  expect(entry.sets[1].drops[0]).toBe(sameDrop);expect(entry.sets[1].drops[1].w).toBeCloseTo(40.12345678/LB_PER_KG,12)
  expect(view.workouts[0].vol).toBeCloseTo(1000/LB_PER_KG,12);expect(S).toEqual(before)
})
it('projects bodyweight rows and sample stamps without losing precision or changing the source BMI',()=>{
  const kgSample={unit:'kg',w:70.12345678},S={unit:'kg',heightCm:180,bodyweight:[{unit:'lb',w:154.12345678,d:'2026-11-02',samples:[{w:154.12345678},kgSample]}],workouts:[]}
  const before=structuredClone(S),view=statsWeightView(S),row=view.bodyweight[0]
  expect(row.w).toBeCloseTo(154.12345678/LB_PER_KG,12);expect(row.samples[0].w).toBeCloseTo(154.12345678/LB_PER_KG,12)
  expect(row.samples[1]).toBe(kgSample);expect(bmiFor(row.w,view.unit,180)).toBe(21.6)
  expect(bmiFor(S.bodyweight[0].w,S.unit,180)).toBe(47.6);expect(S).toEqual(before)
})
it('retains independent workout bodyweight stamps and the authoritative cached volume',()=>{
  const S={unit:'kg',workouts:[{unit:'lb',bw:154.12345678,bwUnit:'lb',bodyweight:70.12345678,bodyweightUnit:'kg',vol:123.456789,entries:[]}],bodyweight:[]}
  const before=structuredClone(S),workout=statsWeightView(S).workouts[0]
  expect(workout.bw).toBeCloseTo(154.12345678/LB_PER_KG,12);expect(workout.bodyweight).toBe(70.12345678)
  expect(workout.vol).toBeCloseTo(123.456789/LB_PER_KG,12);expect(workout.unit).toBe('kg');expect(workout.bwUnit).toBe('kg');expect(workout.bodyweightUnit).toBe('kg')
  expect(S).toEqual(before)
})
it('does not round projected insights or alter timed increments, modes, set roles or confirmations',()=>{
  const set={w:20.123456789,sec:90,leftSec:88,rightSec:91,mode:'time',role:'top',phase:'work',done:false,leftDone:true,rightDone:false}
  const S={unit:'lb',workouts:[{unit:'kg',entries:[{mode:'time',inc:15,target:{weight:20.123456789,inc:15,loadingStep:2.5},sets:[set]}]}],bodyweight:[]}
  const before=structuredClone(S),view=statsWeightView(S),entry=view.workouts[0].entries[0]
  expect(entry.sets[0]).toEqual({...set,w:20.123456789*LB_PER_KG})
  expect(entry.target.weight).toBe(20.123456789*LB_PER_KG);expect(entry.target.loadingStep).toBe(2.5*LB_PER_KG)
  expect(entry.inc).toBe(15);expect(entry.target.inc).toBe(15);expect(S).toEqual(before)
})
it('leaves unrelated records, active sessions and configuration references raw and is idempotent',()=>{
  const S={unit:'kg',workouts:[{unit:'lb',entries:[{sets:[{w:80,r:8,done:true}]}]}],bodyweight:[{w:154,unit:'lb'}],active:{unit:'lb',entries:[{sets:[{w:80}]}]},routines:[{ex:[{weight:80,unit:'lb'}]}],measurements:[{unit:'in',waist:34}],inbody:[{weight:70}],heightHistory:[{cm:180}],profile:{name:'Synthetic profile'}}
  const before=structuredClone(S),view=statsWeightView(S)
  for(const key of['active','routines','measurements','inbody','heightHistory','profile'])expect(view[key]).toBe(S[key])
  expect(statsWeightView(view)).toBe(view);expect(S).toEqual(before)
})
it('does not coerce missing or invalid masses into zero or convert time-unit aliases',()=>{
  const S={unit:'kg',workouts:[{unit:'lb',entries:[{target:{unit:'reps',reps:8},sets:[{unit:'seconds',sec:90,w:null},{w:''},{w:false},{w:'unrecorded'}]}]}],bodyweight:[]}
  const view=statsWeightView(S),entry=view.workouts[0].entries[0]
  expect(entry.target.unit).toBe('reps');expect(entry.sets[0].unit).toBe('seconds')
  expect(entry.sets.map(row=>row.w)).toEqual([null,'',false,'unrecorded'])
})
