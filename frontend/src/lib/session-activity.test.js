import { describe, expect, it } from 'vitest'
import { hasWorkoutActivity, sessionOrigin, startSessionOrigin } from './session-activity.js'
import { buildCompletedWorkout } from './finish-workout.js'
import { dailyPlan } from './daily-plan.js'
import { consistencyStats } from './consistency.js'
import { trainingStreak } from './training-plan.js'
import { buildProgressReport } from './progress-report.js'
import { migrateState } from './state-migrations.js'
import { nextRoutineId } from '../../../api/workout-plan.js'
import { calendarDay } from './calendar-data.js'
import { hasWorkoutActivity as apiActivity } from '../../../api/session-activity.js'

const d='2026-09-21', now=new Date(d+'T12:00:00')
const entry=id=>({id,target:{mode:'reps'},sets:[{done:true,r:8,w:50}]})
const state=()=>({routines:[{id:'r',name:'Routine',ex:[{id:'a'}]}],week:{1:['r']},workouts:[],trainingStartDate:d})
const active=(routineId='r')=>({id:'planned',d,start:now.getTime()-60000,routineId,name:'Routine',sessionOrigin:startSessionOrigin(routineId),entries:[entry('a')]})
const finish=a=>buildCompletedWorkout(a,{end:now.getTime()})
const metrics=S=>consistencyStats(S,d,d,now)

describe('stable session origin and daily activity acceptance',()=>{
 it.each(['unchanged','add three','replace/remove','edit prescription'])('keeps one planned session and no extras after %s',edit=>{
  const S=state(),a=active()
  if(edit==='add three')a.entries.push(...['b','c','e'].map(entry))
  if(edit==='replace/remove')a.entries=[entry('replacement')]
  if(edit==='edit prescription')Object.assign(a.entries[0].sets[0],{r:12,w:75,rest:10})
  S.workouts=[finish(a)]
  expect(dailyPlan(S,d)).toMatchObject({completed:1,plannedSessions:1,extra:0,active:true})
  expect(metrics(S)).toMatchObject({planned:1,completed:1,extra:0,activeDays:1,rate:1})
  expect(trainingStreak(S,now)).toMatchObject({current:1,best:1})
 })
 it('counts a separate unscheduled session as extra while deduplicating the activity day',()=>{
  const S=state();S.workouts=[finish(active()),finish({...active(null),id:'extra'})]
  expect(metrics(S)).toMatchObject({planned:1,completed:1,extra:1,activeDays:1,rate:1})
  expect(trainingStreak(S,now).current).toBe(1)
  const report=buildProgressReport(S,{now})
  expect(report.summary).toMatchObject({workouts:2,activeDays:1,extra:1,rate:1})
 })
 it('removing an exercise preserves the origin and never creates a second session',()=>{
  const S=state(),a=active();a.entries.push(entry('second'));a.entries.splice(0,1);S.workouts=[finish(a)]
  expect(metrics(S)).toMatchObject({planned:1,completed:1,extra:0,activeDays:1,rate:1})
  expect(trainingStreak(S,now).current).toBe(1)
 })
 it('credits extra activity even when the scheduled routine remains missed',()=>{
  const S=state();S.workouts=[finish({...active(null),id:'extra'})]
  expect(consistencyStats(S,d,d,new Date('2026-09-22T12:00:00'))).toMatchObject({completed:0,missed:1,extra:1,activeDays:1,rate:1})
  expect(trainingStreak(S,now).current).toBe(1)
  expect(nextRoutineId(S,d)).toBe('r')
  expect(calendarDay(S,d,now)).toMatchObject({status:'completed',plan:{completed:0,extra:1,active:true}})
 })
 it('preserves planned origin when the routine or calendar is edited or deleted',()=>{
  const S=state();S.workouts=[finish(active())];S.routines=[];S.week={}
  expect(metrics(S)).toMatchObject({planned:1,completed:1,extra:0,activeDays:1,rate:1})
  expect(sessionOrigin(S.workouts[0]).type).toBe('planned')
 })
 it('survives active migration, finish, serialized reopen and changed exercise IDs',()=>{
  const S=state();S.active=active();S.active.entries=[entry('changed')]
  const reopened=migrateState(JSON.parse(JSON.stringify(S)))
  reopened.workouts=[finish(reopened.active)];reopened.active=null
  expect(metrics(migrateState(JSON.parse(JSON.stringify(reopened))))).toMatchObject({planned:1,extra:0,rate:1})
 })
 it('deduplicates IDs and rejects empty, pending, warmup-only and canceled sessions',()=>{
  const S=state(),w=finish(active());S.workouts=[w,{...w},{...w,id:'empty',entries:[]},{...w,id:'pending',entries:[{...entry('a'),sets:[{done:false,r:8}]}]},{...w,id:'warm',entries:[{...entry('a'),sets:[{done:true,r:8,warmup:true}]}]},{...w,id:'cancel',cancelled:true}]
  expect(metrics(S)).toMatchObject({completed:1,extra:0,activeDays:1})
 })
 it('accepts actual repetitions, timed sides and cardio without requiring external weight',()=>{
  for(const set of [{done:true,r:8,w:0},{done:true,sec:30},{leftDone:true,leftSec:15,mode:'time'},{done:true,min:5}])expect(hasWorkoutActivity({entries:[{sets:[set]}]})).toBe(true)
  for(const set of [{done:true,r:0},{done:true,sec:0},{done:true,min:-1},{done:true,r:NaN},{done:false,r:8}])expect(hasWorkoutActivity({entries:[{sets:[set]}]})).toBe(false)
 })
 it('retains rest-day and pending-today semantics while adding extra activity days',()=>{
  const S=state();S.workouts=[finish(active()),{...finish({...active(null),id:'extra'}),d:'2026-09-22'}]
  expect(trainingStreak(S,new Date('2026-09-28T12:00:00')).current).toBe(2)
  expect(trainingStreak(S,new Date('2026-09-29T12:00:00')).current).toBe(0)
 })
 it('uses stable IDs for legacy history and refuses ambiguous name-only matches',()=>{
  const S=state();const w=finish(active());delete w.sessionOrigin;w.entries=[entry('new')];S.workouts=[w]
  expect(metrics(S).extra).toBe(0)
  S.routines.push({id:'other',name:'Routine'});delete w.routineId
  expect(dailyPlan(S,d).completed).toBe(0)
  expect(nextRoutineId(S,d)).toBe('r')
 })
 it('keeps frontend and independently deployed API row semantics identical',()=>{
  for(const target of [{},{mode:'reps'},{mode:'time'},{mode:'cardio'},{mode:'amrap'},{unit:'seconds'}])for(const set of [{done:true,r:8},{done:true,sec:30},{done:true,min:5},{leftDone:true,leftSec:20,mode:'time'},{done:true,r:0},{done:true,r:8,warmup:true},{done:true,r:8,warmup:true,phase:'work'}]){
   const workout={entries:[{target,sets:[set]}]};expect(hasWorkoutActivity(workout)).toBe(apiActivity(workout))
  }
 })
})
