import { describe, it, expect } from 'vitest'
import { trainingStart, trackingStart, statisticsState, historySummary, validateTrainingHistory } from './training-history.js'
import { calendarPeriod, calendarDay } from './calendar-data.js'
import { consistencyStats } from './consistency.js'
import { trainingStreak } from './training-plan.js'
import { calendarReportPages, reportFilename } from './calendar-report.js'
import { fmtScheduledDate } from './format.js'
import { createBackup, readBackup } from './backup.js'
const today='2026-09-23', now=new Date(today+'T12:00:00')
const base=()=>({routines:[{id:'r',name:'Pierna & <espalda> ñ'}],week:{1:'r',3:'r',5:'r'},workouts:[],trainingStartDate:'2026-09-15',trainingHistory:{trackedFrom:'2026-09-15',historicalWorkouts:0,workoutsPerWeek:3}})
describe('training history without fabricated sessions',()=>{
 it('new profiles default to today and have no missed history',()=>{
  expect(trainingStart({},today)).toBe(today)
  const report=calendarPeriod({},now,'year',now)
  expect(report.counts.missed).toBe(0);expect(report.counts.untracked).toBe(265);expect(report.completion).toBeNull()
 })
 it('proposes the earliest real date for legacy profiles without mutating them',()=>{
  const S={workouts:[{id:'a',d:'2025-12-31'},{id:'b',d:today}],scheduleStarted:today}
  expect(trainingStart(S,today)).toBe('2025-12-31');expect(trackingStart(S,today)).toBe('2025-12-31');expect(S.trainingStartDate).toBeUndefined()
 })
 it('excludes days before the start from calendar, adherence and streaks',()=>{
  const S=base();S.workouts=[{id:'old',d:'2026-09-14',routineId:'r'},{id:'a',d:'2026-09-16',routineId:'r'}]
  expect(calendarDay(S,'2026-09-14',now).status).toBe('untracked')
  expect(consistencyStats(S,'2026-09-01','2026-09-14',now).rate).toBeNull()
  expect(trainingStreak(S,now).rows.every(r=>r.iso>=S.trainingStartDate)).toBe(true)
  expect(statisticsState(S,today).workouts.map(w=>w.id)).toEqual(['a']);expect(S.workouts).toHaveLength(2)
 })
 it('separates estimates from tracked sessions and exact metrics',()=>{
  const S=base();S.trainingStartDate='2025-01-01';S.trainingHistory.historicalWorkouts=200
  S.workouts=[{id:'a',d:'2026-09-16',routineId:'r'},{id:'a',d:'2026-09-16'},{id:'c',d:'2026-09-18',cancelled:true}]
  expect(historySummary(S,today)).toMatchObject({trackedWorkouts:1,historicalWorkouts:200,total:201,scheduledPerWeek:3})
  expect(statisticsState(S,today).workouts).toHaveLength(1)
  expect(calendarDay(S,'2025-01-03',now).status).toBe('untracked')
  expect(calendarPeriod(S,now,'year',now).stats.completed).toBe(1)
  expect(trainingStreak(S,now).best).toBe(1)
 })
 it('handles today without division by zero and counts a leap day once',()=>{
  const S=base();S.trainingStartDate=today;S.workouts=[{id:'a',d:today}]
  expect(historySummary(S,today).averagePerWeek).toBe(7)
  S.trainingStartDate='2024-02-28';S.workouts=[{id:'a',d:'2024-02-29'}]
  expect(historySummary(S,'2024-03-01').averagePerWeek).toBeCloseTo(7/3)
 })
 it('persists through backup and filters edits without deleting old records',()=>{
  const S=base();S.workouts=[{id:'a',d:'2026-09-16'}]
  const restored=readBackup(createBackup(S))
  expect(restored.trainingHistory).toEqual(S.trainingHistory)
  restored.trainingStartDate=today
  expect(statisticsState(restored,today).workouts).toHaveLength(0);expect(restored.workouts).toHaveLength(1)
  expect(validateTrainingHistory(today,{...S.trainingHistory,historicalWorkouts:2},today)).toBe(false)
 })
 it.each(['week','month','year','full'])('generates %s with sparse data, escaped labels and cross-year dates',period=>{
  const pages=calendarReportPages({},'2024-12-31',period,'pdf',{now:new Date('2025-01-01T12:00:00'),t:s=>s+' & <ñ>'})
  expect(pages.length).toBeGreaterThan(0);expect(pages[0].svg).toContain('&amp; &lt;ñ&gt;')
 })
 it('formats weekday and full numeric date in both languages',()=>{
  expect(fmtScheduledDate('2026-09-24','en-GB')).toBe('Thursday, 24/09/2026')
  expect(fmtScheduledDate('2026-09-24','es-ES')).toBe('jueves, 24/09/2026')
 })
})

it('exports a large archive without mutation, counting duplicate IDs only once',()=>{
 const S=base();S.trainingStartDate='2024-01-01';S.trainingHistory.trackedFrom='2024-01-01'
 S.workouts=Array.from({length:10000},(_,i)=>({id:String(i),d:'2024-02-29',name:'長い名前 & <ñ>',routineId:'r'}))
 const before=JSON.stringify(S)
 const result=calendarPeriod(S,new Date('2024-02-29T12:00:00'),'year',new Date('2024-12-31T12:00:00'))
 expect(result.days).toHaveLength(366);expect(result.counts.completed).toBe(1);expect(result.stats.extra).toBe(10000)
 expect(JSON.stringify(S)).toBe(before)
})

it('does not hide recorded sessions when the entered tracking boundary is later',()=>{
 const S=base();S.trainingHistory.trackedFrom='2026-09-23';S.workouts=[{id:'a',d:'2026-09-16',routineId:'r'}]
 expect(trackingStart(S,today)).toBe('2026-09-16')
 expect(calendarDay(S,'2026-09-16',now).status).toBe('completed')
 S.trainingStartDate='2026-09-20'
 expect(trackingStart(S,today)).toBe('2026-09-23')
})
it('excludes canceled and active rows from legacy start inference',()=>{
 const S={workouts:[{d:'2020-01-01',status:'cancelled'},{id:'active',d:'2020-01-02'},{d:today}],active:{id:'active'}}
 expect(trainingStart(S,today)).toBe(today)
})

it('keeps a date-only week filename stable across time zones',()=>{
 expect(reportFilename('2026-09-21','week','pdf')).toBe('TGym-Consistency-Week-2026-09-21.pdf')
})
it('does not invent missed training for deleted routines',()=>{
 const S=base();S.routines=[]
 expect(calendarDay(S,'2026-09-16',now)).toMatchObject({planned:false,status:'rest'})
})
