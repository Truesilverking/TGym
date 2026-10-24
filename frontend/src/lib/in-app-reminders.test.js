import {describe,it,expect} from 'vitest'
import {inAppReminderItems,inAppReminderMode,dismissInAppReminder} from './in-app-reminders.js'
import {createBackup,readBackup} from './backup.js'
import {postponeMeasurement} from './measurement-reminders.js'

const state=()=>({routines:[{id:'a',name:'Upper'},{id:'b',name:'Lower'}],week:{4:['a'],5:['b']},dayPlan:{},workouts:[],bodyweight:[],measurements:[],reminder:{on:true},measurementReminders:{notifications:false,items:{weight:{enabled:true,anchorDate:'2026-09-09',intervalUnit:'days',intervalValue:1},bodySize:{enabled:true,anchorDate:'2026-09-10',intervalUnit:'days',intervalValue:1}}},deload:{on:false}})
describe('in-app notices use existing local due dates independently of OS alerts',()=>{
 it('defaults to both days, reads without mutation, and groups each scheduled day once',()=>{
  const S=state(),before=structuredClone(S),items=inAppReminderItems(S,'2026-09-10')
  expect(items.map(i=>[i.kind,i.date])).toEqual([['measurement','2026-09-10'],['workout','2026-09-10'],['measurement','2026-09-11'],['workout','2026-09-11']])
  expect(new Set(items.map(i=>i.id)).size).toBe(items.length)
  expect(inAppReminderMode(S)).toBe('both');expect(S).toEqual(before)
  expect(inAppReminderItems(readBackup(createBackup(S)),'2026-09-10')).toEqual(items)
 })
 it.each([['today',['2026-09-10']],['previous',['2026-09-11']],['off',[]]])('honors mode %s without changing reminder settings', (mode,dates)=>{
  const S=state();S.inAppReminderMode=mode
  expect([...new Set(inAppReminderItems(S,'2026-09-10').map(i=>i.date))]).toEqual(dates)
  expect(S.measurementReminders.notifications).toBe(false);expect(S.reminder.on).toBe(true)
 })
 it('removes completed/skipped/paused work and disabled measurements without fabricating history',()=>{
  const S=state();S.workouts=[{id:'w',d:'2026-09-10',sessionOrigin:{type:'planned',routineId:'a'},entries:[{id:'e',sets:[{done:true,r:6}]}]}]
  S.daySkipped={'2026-09-11':['b']};S.measurementReminders.items.weight.enabled=false
  expect(inAppReminderItems(S,'2026-09-10').map(i=>i.kind)).toEqual(['measurement'])
  S.trainingPauses=[{id:'p',start:'2026-09-10',end:null}]
  expect(inAppReminderItems(S,'2026-09-10').filter(i=>i.kind==='workout')).toEqual([])
  expect(S.workouts).toHaveLength(1)
 })
 it('dismisses idempotently through backup/reopen and keeps the next day independent',()=>{
  const S=state(),item=inAppReminderItems(S,'2026-09-10').find(i=>i.date==='2026-09-11'&&i.kind==='measurement')
  dismissInAppReminder(S,item.id);dismissInAppReminder(S,item.id)
  const restored=readBackup(JSON.parse(JSON.stringify(createBackup(S))))
  expect(restored.inAppReminderDismissed).toEqual([item.id])
  expect(inAppReminderItems(restored,'2026-09-10').some(i=>i.id===item.id)).toBe(false)
  expect(inAppReminderItems(restored,'2026-09-11').some(i=>i.metric===item.metric&&i.today)).toBe(true)
  expect(restored.bodyweight).toEqual([]);expect(restored.workouts).toEqual([])
 })
 it('shares snoozed measurement dates and removes a due notice after recording',()=>{
  const S=state();postponeMeasurement(S,'weight',false,'2026-09-10')
  expect(inAppReminderItems(S,'2026-09-10').find(i=>i.metric==='weight').date).toBe('2026-09-11')
  S.bodyweight=[{d:'2026-09-10',w:80}]
  expect(inAppReminderItems(S,'2026-09-11').find(i=>i.metric==='weight').today).toBe(true)
  S.bodyweight.push({d:'2026-09-11',w:80})
  expect(inAppReminderItems(S,'2026-09-11').find(i=>i.metric==='weight').today).toBe(false)
 })
 it('uses calendar tomorrow across DST/month ends and reuses the deload cycle',()=>{
  const previous=process.env.TZ
  try{
   process.env.TZ='America/New_York'
   const S=state();S.reminder.on=false;S.measurementReminders.items={weight:{enabled:true,anchorDate:'2028-01-31',intervalUnit:'months',intervalValue:1}}
   expect(inAppReminderItems(S,'2028-02-28')[0].date).toBe('2028-02-29')
   S.measurementReminders.items={weight:{enabled:true,anchorDate:'2026-03-07',intervalUnit:'days',intervalValue:2}}
   expect(inAppReminderItems(S,'2026-03-08')[0].date).toBe('2026-03-09')
   S.measurementReminders.items={};S.deload={on:true,notifications:false,startDate:'2026-08-03',normalWeeks:6}
   expect(inAppReminderItems(S,'2026-09-13')).toMatchObject([{kind:'deload',date:'2026-09-14',today:false}])
   expect(inAppReminderItems(S,'2026-09-14')).toMatchObject([{kind:'deload',date:'2026-09-14',today:true}])
   S.trainingPauses=[{start:'2026-09-13',end:null}]
   expect(inAppReminderItems(S,'2026-09-13')).toEqual([])
  }finally{if(previous==null)delete process.env.TZ;else process.env.TZ=previous}
 })
})
