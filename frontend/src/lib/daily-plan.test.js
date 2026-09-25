import {describe,it,expect} from 'vitest'
import {dailyPlan,nextDailyRoutine,skipDailyRoutine,removeRoutineAssignments} from './daily-plan.js'
import {migrateState} from './state-migrations.js'
import {consistencyStats,nextScheduledWorkout} from './consistency.js'
import {trainingStreak} from './training-plan.js'
import {calendarDay} from './calendar-data.js'
import {workoutNotificationPlan} from './workout-reminders.js'
import {mergeTGymStates} from './state-merge.js'
import {buildPlanBundle,parsePlan,mergePlan} from './plan-share.js'

const date='2026-09-21',now=new Date(date+'T10:00:00')
const fixture=()=>({routines:[{id:'upper',name:'Upper',ex:[]},{id:'run',name:'Running',ex:[]},{id:'core',name:'Core',ex:[]}],week:{1:['upper','run','core']},dayPlan:{},workouts:[],scheduleStarted:date,trainingStartDate:date,reminder:{on:true,time:'18:00',nextTime:'19:00'}})
const complete=(S,id,n=id)=>S.workouts.push({id:n,routineId:id,d:date,name:id,entries:[]})
describe('ordered daily training plans',()=>{
 it('round trips all ordered assignments through plan sharing with remapped routine IDs',()=>{const S=fixture(),bundle=parsePlan(buildPlanBundle(S)),target={routines:[],week:{},customEx:[]};mergePlan(target,bundle,{schedule:true});expect(target.week[1]).toEqual(target.routines.map(r=>r.id));expect(target.routines.map(r=>r.name)).toEqual(['Upper','Running','Core'])})
 it('migrates scalar weekly and date assignments without altering history, active session or rest overrides',()=>{
  const old={...fixture(),storageVersion:2,week:{1:'upper'},dayPlan:{[date]:'run','2026-09-22':'rest'},active:{id:'live',start:2,entries:[]}}
  const snapshot=structuredClone(old),next=migrateState(old)
  expect(next.week[1]).toEqual(['upper']);expect(next.dayPlan).toEqual({[date]:['run'],'2026-09-22':[]});expect(next.active).toEqual(old.active);expect(next.workouts).toEqual(old.workouts);expect(old).toEqual(snapshot);expect(migrateState(next)).toEqual(next)
 })
 it('resumes the next pending routine after completed sessions and serialized reopen',()=>{
  const S=fixture();expect(nextDailyRoutine(S,date).id).toBe('upper');complete(S,'upper')
  const reopened=migrateState(JSON.parse(JSON.stringify(S)));expect(nextDailyRoutine(reopened,date).id).toBe('run');complete(reopened,'run');expect(nextDailyRoutine(reopened,date).id).toBe('core');complete(reopened,'core');expect(nextDailyRoutine(reopened,date)).toBeNull()
 })
 it('counts sessions independently and advances a streak only when the full scheduled day is completed',()=>{
  const S=fixture();complete(S,'upper');complete(S,'run');expect(consistencyStats(S,date,date,now)).toMatchObject({planned:3,completed:2,pending:1,missed:0,extra:0});expect(trainingStreak(S,now).current).toBe(0)
  expect(calendarDay(S,date,now)).toMatchObject({status:'partial',plan:{completed:2,total:3}})
  expect(consistencyStats(S,date,date,new Date('2026-09-22T10:00:00'))).toMatchObject({completed:2,missed:1,rate:2/3})
  complete(S,'core');expect(trainingStreak(S,now).current).toBe(1);expect(calendarDay(S,date,now).status).toBe('completed')
 })
 it('keeps order, skip and later independent from workout data',()=>{
  const S=fixture();S.week[1]=['run','core','upper'];skipDailyRoutine(S,date,'run');expect(nextDailyRoutine(S,date).id).toBe('core');expect(dailyPlan(S,date)).toMatchObject({completed:0,skipped:1,total:3});expect(S.workouts).toEqual([])
  expect(consistencyStats(S,date,date,now)).toMatchObject({planned:3,missed:1,pending:2});expect(nextScheduledWorkout(S,now)).toBe(date)
 })
 it('does not let extra sessions, duplicate IDs or a canceled workout complete remaining routines',()=>{
  const S=fixture();complete(S,'upper','one');complete(S,'upper','one');S.workouts.push({id:'cancel',d:date,routineId:'run',cancelled:true},{id:'extra',d:date,name:'Freestyle'})
  expect(dailyPlan(S,date)).toMatchObject({completed:1,extra:1});expect(nextDailyRoutine(S,date).id).toBe('run')
 })
 it('notifies the next routine and remaining count without reminding about completed routines',()=>{
  const S=fixture();complete(S,'upper');expect(workoutNotificationPlan(S,now)[0]).toMatchObject({routineId:'run',remaining:2});complete(S,'run');skipDailyRoutine(S,date,'core');expect(workoutNotificationPlan(S,now).some(n=>n.date===date)).toBe(false)
 })
 it('honors ordered date overrides, rest, pauses and deleting just one assignment',()=>{
  const S=fixture();S.dayPlan[date]=['run','upper'];expect(nextDailyRoutine(S,date).id).toBe('run');removeRoutineAssignments(S,'run');expect(S.week[1]).toEqual(['upper','core']);expect(S.dayPlan[date]).toEqual(['upper']);S.dayPlan[date]=[];expect(dailyPlan(S,date).total).toBe(0);delete S.dayPlan[date];S.trainingPauses=[{start:date,end:null}];expect(dailyPlan(S,date).total).toBe(0)
 })
 it('treats conflicting order/removal as an explicit cloud conflict rather than resurrecting routines',()=>{
  const local=fixture(),remote=fixture();local.week[1]=['core'];const merged=mergeTGymStates(local,remote);expect(merged.merged.week[1]).toEqual(['core']);expect(merged.conflicts.some(c=>c.path==='week.1')).toBe(true)
 })
})

it('does not reuse an ID-less legacy session for same-named routines',()=>{
 const S=fixture();S.routines[1].name='Upper';S.workouts=[{id:'legacy',d:date,name:'Upper'}];expect(dailyPlan(S,date).completed).toBe(1);expect(nextDailyRoutine(S,date).id).toBe('run')
})
