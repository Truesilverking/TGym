import { describe, expect, it } from 'vitest'
import { pauseTraining, resumeTraining, isTrainingPaused, pausedDaysBetween, dayNumber } from './training-pause.js'
import { deloadStatus, trainingStreak } from './training-plan.js'
import { consistencyStats, nextScheduledWorkout } from './consistency.js'
import { calendarDay, calendarPeriod } from './calendar-data.js'
import { effectiveRoutineId } from './history.js'
import { workoutNotificationPlan, deloadNotificationPlan } from './workout-reminders.js'
import { createBackup, readBackup } from './backup.js'
import { mergeTGymStates } from './state-merge.js'
import { isTrainingPaused as serverPaused } from '../../../api/training-pause.js'
const base=()=>({routines:[{id:'r',name:'Routine'}],week:{1:'r',3:'r',5:'r'},dayPlan:{},scheduleStarted:'2026-01-05',workouts:['05','07','09'].map(d=>({id:d,d:'2026-01-'+d,routineId:'r'})),deload:{on:true,startDate:'2026-01-05',normalWeeks:1,deloadWeeks:1},reminder:{on:true,time:'18:00',nextTime:'19:00'}})
const withPause=(start,end)=>({...base(),trainingPauses:[{id:'p',start,end}]})
const noon=d=>new Date(d+'T12:00:00')
describe('training break lifecycle',()=>{
 it('starts today without rewriting previous dates',()=>{
  const s=base(), rows=structuredClone(s.workouts)
  s.trainingPauses=pauseTraining(s,'2026-01-12','p')
  expect(s.trainingPauses).toEqual([{id:'p',start:'2026-01-12',end:null}])
  expect(isTrainingPaused(s,'2026-01-09')).toBe(false)
  expect(s.workouts).toEqual(rows)
  expect(pauseTraining(s,'2026-01-13','duplicate')).toHaveLength(1)
 })
 it('protects a workout already logged today and blocks an active session',()=>{
  const s=base()
  expect(pauseTraining(s,'2026-01-09','p')[0].start).toBe('2026-01-10')
  expect(()=>pauseTraining({...s,active:{id:'a'}},'2026-01-12','p')).toThrow('active-workout')
 })
 it('resumes today, preserves history and cancels a same-day pause without moving the cycle',()=>{
  const s=withPause('2026-01-12',null)
  s.trainingPauses=resumeTraining(s,'2026-01-12')
  expect(s.trainingPauses[0].end).toBe('2026-01-12')
  expect(isTrainingPaused(s,'2026-01-12')).toBe(false)
  expect(deloadStatus(s,'2026-01-12').active).toBe(true)
 })
 it('cancels a tomorrow pause without erasing its cancellation record',()=>{
  const s=withPause('2026-01-13',null)
  s.trainingPauses=resumeTraining(s,'2026-01-12')
  expect(s.trainingPauses[0].end).toBe('2026-01-13')
  expect(pausedDaysBetween(s,'2026-01-01','2026-02-01')).toBe(0)
 })
 it('ignores malformed imported intervals and counts overlapping ranges once',()=>{
  const s={trainingPauses:[{start:'bad'}, {start:'2026-02-30'}, {start:'2026-01-07',end:'2026-01-10'},{start:'2026-01-09',end:'2026-01-12'}]}
  expect(pausedDaysBetween(s,'2026-01-05','2026-01-20')).toBe(5)
  expect(dayNumber('2026-02-30')).toBeNaN()
 })
})
describe('streak, consistency and calendar',()=>{
 it('freezes without incrementing the streak or marking missed days',()=>{
  const s=withPause('2026-01-12',null)
  expect(trainingStreak(s,noon('2026-02-20')).current).toBe(3)
  expect(consistencyStats(s,'2026-01-05','2026-02-20',noon('2026-02-20'))).toMatchObject({completed:3,planned:3,missed:0,rate:1})
  expect(calendarDay(s,'2026-01-14').status).toBe('paused')
  expect(calendarPeriod(s,noon('2026-01-12'),'week').counts.paused).toBe(7)
  expect(nextScheduledWorkout(s,noon('2026-01-12'))).toBeNull()
  expect(effectiveRoutineId({...s,dayPlan:{'2026-01-14':'r'}},'2026-01-14')).toBeNull()
 })
 it('does not repair an absence before the pause',()=>{
  const s=withPause('2026-01-14',null)
  expect(trainingStreak(s,noon('2026-01-16')).current).toBe(0)
  expect(consistencyStats(s,'2026-01-05','2026-01-16',noon('2026-01-16')).missed).toBe(1)
 })
 it('returns to normal weekdays and starts counting missed days again after resume',()=>{
  const s=withPause('2026-01-12','2026-01-20')
  expect(nextScheduledWorkout(s,noon('2026-01-12'))).toBe('2026-01-21')
  expect(trainingStreak(s,noon('2026-01-21')).current).toBe(3)
  expect(trainingStreak(s,noon('2026-01-22')).current).toBe(0)
  s.workouts.push({id:'21',d:'2026-01-21',routineId:'r'})
  expect(trainingStreak(s,noon('2026-01-22')).current).toBe(4)
 })
 it('does not age a saved streak out during a multi-year pause',()=>{
  const s={...base(),scheduleStarted:'2024-01-08',workouts:[{d:'2024-01-08',routineId:'r'}],trainingPauses:[{id:'p',start:'2024-01-09',end:null}]}
  expect(trainingStreak(s,noon('2026-09-23')).current).toBe(1)
 })
})
describe('deload active-day clock',()=>{
 it('moves every later cycle by the exact paused calendar days',()=>{
  const s=withPause('2026-01-10','2026-01-13')
  expect(deloadStatus(s,'2026-01-09')).toMatchObject({active:false,start:'2026-01-15'})
  expect(deloadStatus(s,'2026-01-15')).toMatchObject({active:true,start:'2026-01-15',end:'2026-01-21',nextStart:'2026-01-29'})
  expect(deloadStatus(s,'2026-01-22').active).toBe(false)
  expect(deloadStatus(s,'2026-01-29').active).toBe(true)
 })
 it('freezes a partially completed deload, preserving its remaining days',()=>{
  const s=withPause('2026-01-14','2026-01-17')
  expect(deloadStatus(s,'2026-01-13').active).toBe(true)
  expect(deloadStatus(s,'2026-01-15')).toMatchObject({active:false,paused:true,nextStart:null})
  expect(deloadStatus(s,'2026-01-17')).toMatchObject({active:true,start:'2026-01-12',end:'2026-01-21'})
 })
 it('has no invented resumption date while a pause remains open',()=>{
  const s=withPause('2026-01-10',null)
  expect(deloadStatus(s,'2026-01-12')).toMatchObject({active:false,paused:true,daysUntil:null,nextStart:null,end:null})
  s.trainingPauses=resumeTraining(s,'2026-01-13')
  expect(deloadStatus(s,'2026-01-13').start).toBe('2026-01-15')
 })
 it('ignores pauses before the anchor and clips overlapping pauses to it',()=>{
  expect(deloadStatus(withPause('2025-12-01','2026-01-03'),'2026-01-12').active).toBe(true)
  expect(deloadStatus(withPause('2026-01-03','2026-01-08'),'2026-01-08').start).toBe('2026-01-15')
 })
 it('does not extend a completed deload when the pause begins after its last day',()=>{
  expect(deloadStatus(withPause('2026-01-19','2026-01-22'),'2026-01-18').end).toBe('2026-01-18')
 })
 it('counts calendar days across daylight-saving boundaries',()=>{
  expect(pausedDaysBetween(withPause('2026-03-07','2026-03-10'),'2026-03-01','2026-03-15')).toBe(3)
 })
})
describe('reminders and portable state',()=>{
 it('suppresses workout and deload reminders while paused, including the server',()=>{
  const s=withPause('2026-01-12',null)
  expect(workoutNotificationPlan(s,noon('2026-01-14'))).toEqual([])
  expect(deloadNotificationPlan(s,noon('2026-01-14'))).toEqual([])
  expect(serverPaused(s,'2026-01-14')).toBe(true)
  s.trainingPauses=resumeTraining(s,'2026-01-14')
  expect(workoutNotificationPlan(s,noon('2026-01-14')).length).toBeGreaterThan(0)
  expect(serverPaused(s,'2026-01-14')).toBe(false)
  expect(deloadNotificationPlan(s,noon('2026-01-14'))[0].start).toBe('2026-01-14')
 })
 it('round trips pause history and protects ended pauses from stale cloud copies',()=>{
  const old=withPause('2026-01-12',null), current=withPause('2026-01-12','2026-01-15')
  const restored=readBackup(createBackup(current))
  expect(restored.trainingPauses).toEqual(current.trainingPauses)
  expect(mergeTGymStates(old,restored).merged.trainingPauses[0].end).toBe('2026-01-15')
  expect(mergeTGymStates(restored,old).merged.trainingPauses[0].end).toBe('2026-01-15')
  expect(mergeTGymStates(restored,withPause('2026-01-12','2026-01-12')).merged.trainingPauses[0].end).toBe('2026-01-12')
  expect(()=>createBackup(withPause('2026-02-30',null))).toThrow('Invalid training pause')
 })
})
