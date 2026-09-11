import {describe,it,expect} from 'vitest'
import {workoutNotificationPlan} from './workout-reminders.js'
import {createBackup,readBackup} from './backup.js'
const now = new Date('2026-09-10T07:00:00')
const state = () => ({routines:[{id:'a',name:'Upper A'},{id:'b',name:'Lower A'}],week:{4:'a',5:'b'},dayPlan:{},workouts:[],reminder:{on:true,time:'08:00',nextTime:'19:00'}})
describe('state-aware workout reminders',()=>{
  it('plans one pending notice and one next notice with direct routine metadata',()=>{
    const notices=workoutNotificationPlan(state(),now)
    expect(notices).toHaveLength(2)
    expect(notices[0]).toMatchObject({id:100,kind:'today',routineId:'a',date:'2026-09-10'})
    expect(notices[1]).toMatchObject({id:101,kind:'tomorrow',routineId:'b',date:'2026-09-11'})
    expect(notices[1].at.getHours()).toBe(19)
  })
  it('drops the pending notice after completion and does not immediately send the next',()=>{
    const S=state(); S.workouts.push({id:'done',d:'2026-09-10',entries:[]})
    const notices=workoutNotificationPlan(S,now)
    expect(notices.map(n=>n.kind)).toEqual(['tomorrow'])
    expect(notices[0].at.getHours()).toBe(19)
  })
  it('uses overrides and searches past rest days',()=>{
    const S=state(); S.dayPlan={'2026-09-10':'rest','2026-09-11':'rest','2026-09-13':'b'}
    expect(workoutNotificationPlan(S,now)).toMatchObject([{kind:'next',date:'2026-09-13',routineId:'b'}])
  })
  it('does not repeat elapsed notices or notify outside enabled settings',()=>{
    expect(workoutNotificationPlan(state(),new Date('2026-09-10T20:00:00'))).toEqual([])
    const S=state(); S.reminder.on=false
    expect(workoutNotificationPlan(S,now)).toEqual([])
  })
  it('preserves schedule in backup and produces stable IDs across restart',()=>{
    const S=state()
    expect(workoutNotificationPlan(readBackup(createBackup(S)),now)).toEqual(workoutNotificationPlan(S,now))
  })
  it('respects quiet hours and day-specific times',()=>{
    const S=state(); S.reminder.dayTimes={4:'09:30'}
    expect(workoutNotificationPlan(S,now)[0].at.getHours()).toBe(9)
    S.reminder.quietOn=true; S.reminder.quietStart='18:00'; S.reminder.quietEnd='10:00'
    expect(workoutNotificationPlan(S,now)).toEqual([])
  })
})
