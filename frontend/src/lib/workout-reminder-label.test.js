import {describe,it,expect,afterEach} from 'vitest'
import {workoutReminderDateLabel} from './workout-reminder-label.js'
import {isoOf,fmtDate,fmtScheduledDate} from './format.js'
import {_setLangState} from './i18n-core.js'
import es from '../locales/es.js'

afterEach(()=>_setLangState('en',{}))
describe('workout reminder date presentation preserves calendar appointments',()=>{
 it.each([['en',{},'Today','Tomorrow'],['es',es,'Hoy','Mañana']])('uses existing %s relative labels only for weekly today/tomorrow', (lang,dict,today,tomorrow)=>{
  _setLangState(lang,dict)
  const S={week:{4:['upper'],5:['lower']},dayPlan:{},reminder:{on:true}},before=structuredClone(S)
  expect(workoutReminderDateLabel(S,'2026-09-10','2026-09-10')).toBe(today)
  expect(workoutReminderDateLabel(S,'2026-09-11','2026-09-10')).toBe(tomorrow)
  expect(workoutReminderDateLabel(S,'2026-09-13','2026-09-10')).toBe(fmtDate('2026-09-13',true))
  expect(S).toEqual(before)
 })
 it.each(['en','es'])('keeps weekday/date for manually dated plans in %s, even today or tomorrow',lang=>{
  _setLangState(lang,lang==='es'?es:{})
  const S={dayPlan:{'2026-09-10':['upper'],'2026-09-11':['lower'],'2026-09-13':'upper'}},before=structuredClone(S)
  for(const date of Object.keys(S.dayPlan)){
   expect(workoutReminderDateLabel(S,date,'2026-09-10')).toBe(fmtDate(date,true))
   expect(workoutReminderDateLabel(S,date,'2026-09-10',fmtScheduledDate)).toBe(fmtScheduledDate(date))
  }
  expect(S).toEqual(before)
 })
 it.each(['America/Santo_Domingo','America/New_York'])('uses local calendar days across UTC midnight and DST in %s',zone=>{
  const previous=process.env.TZ
  try{
   process.env.TZ=zone;_setLangState('en',{})
   const localSunday=isoOf(new Date('2026-09-14T00:30:00Z'))
   expect(localSunday).toBe('2026-09-13')
   expect(workoutReminderDateLabel({},'2026-09-13',localSunday)).toBe('Today')
   expect(workoutReminderDateLabel({},'2026-09-14',localSunday)).toBe('Tomorrow')
   expect(workoutReminderDateLabel({},'2026-03-09','2026-03-08')).toBe('Tomorrow')
   expect(workoutReminderDateLabel({},'2027-01-01','2026-12-31')).toBe('Tomorrow')
  }finally{if(previous==null)delete process.env.TZ;else process.env.TZ=previous}
 })
 it('can resolve relative text from the delivery day rather than the earlier enqueue date',()=>{
  const firesAt=new Date('2026-09-12T19:00:00')
  expect(workoutReminderDateLabel({},'2026-09-13',isoOf(firesAt))).toBe('Tomorrow')
  expect(workoutReminderDateLabel({},'2026-09-13','2026-09-10')).toBe(fmtDate('2026-09-13',true))
 })
})
