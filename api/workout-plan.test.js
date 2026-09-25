import {test} from 'node:test'
import assert from 'node:assert/strict'
import {nextRoutineId} from './workout-plan.js'
const d='2026-09-25'
const state=()=>({routines:[{id:'a',name:'A'},{id:'b',name:'B'}],week:{5:['a','b']},workouts:[]})
test('next reminder follows ordered pending routines, not any completed workout that day',()=>{
 const s=state();assert.equal(nextRoutineId(s,d),'a');s.workouts.push({id:'one',d,routineId:'a'});assert.equal(nextRoutineId(s,d),'b');s.daySkipped={[d]:['b']};assert.equal(nextRoutineId(s,d),null)
})
test('cancelled/active sessions do not suppress a reminder and rest/start/pause are honored',()=>{
 const s=state();s.workouts=[{d,routineId:'a',status:'cancelled'},{id:'live',d,routineId:'a'}];s.active={id:'live'};assert.equal(nextRoutineId(s,d),'a');s.dayPlan={[d]:[]};assert.equal(nextRoutineId(s,d),null);delete s.dayPlan;s.scheduleStarted='2026-09-26';assert.equal(nextRoutineId(s,d),null);delete s.scheduleStarted;s.trainingPauses=[{start:d}];assert.equal(nextRoutineId(s,d),null)
})
test('one legacy name match cannot complete two planned routines',()=>{
 const s=state();s.routines[1].name='A';s.workouts=[{id:'one',d,name:'A'}];assert.equal(nextRoutineId(s,d),'b')
})
