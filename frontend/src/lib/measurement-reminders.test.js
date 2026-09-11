import { describe, expect, it, vi } from 'vitest'
import { addReminderInterval, measurementReminders, measurementEventsOn, measurementNotificationPlan, postponeMeasurement, reminderConfig, REMINDER_METRICS, MEASUREMENT_NOTIFICATION_IDS } from './measurement-reminders.js'
import { calendarDay, calendarPeriod } from './calendar-data.js'
import { trainingStreak } from './training-plan.js'
import { createBackup, readBackup } from './backup.js'
import { syncReminder } from './mobile.js'
const notificationMocks = vi.hoisted(() => ({ cancel: vi.fn(async () => ({})), schedule: vi.fn(async () => ({})), checkPermissions: vi.fn(async () => ({display:'granted'})) }))
vi.mock('@capacitor/local-notifications', () => ({LocalNotifications:notificationMocks}))
const state = () => ({ routines:[],workouts:[],week:{},dayPlan:{},bodyweight:[{d:'2026-09-10',w:80}],measurements:[], measurementReminders:{time:'08:00',notifications:true,items:{weight:{id:'measurement:weight',enabled:true,intervalValue:1,intervalUnit:'weeks',anchorDate:'2026-09-10'}}} })
describe('measurement reminders independent from workouts', () => {
  it('derives due dates from the latest measurement and recalculates interval/deletion', () => {
    const S=state()
    expect(measurementReminders(S)[0].due).toBe('2026-09-17')
    S.bodyweight.push({d:'2026-09-15',w:79})
    expect(measurementReminders(S)[0].due).toBe('2026-09-22')
    expect(measurementEventsOn(S,'2026-09-17')).toHaveLength(0)
    S.measurementReminders.items.weight.intervalValue=2
    expect(measurementReminders(S)[0].due).toBe('2026-09-29')
    S.bodyweight.pop()
    expect(measurementReminders(S)[0].due).toBe('2026-09-24')
  })
  it('clamps month ends and uses local calendar days across daylight saving changes', () => {
    expect(addReminderInterval('2028-01-31',{intervalValue:1,intervalUnit:'months'})).toBe('2028-02-29')
    expect(addReminderInterval('2026-03-07',{intervalValue:2,intervalUnit:'days'})).toBe('2026-03-09')
    const at=measurementNotificationPlan(state(),new Date('2026-09-10T12:00:00'))[0].at
    expect(at.getHours()).toBe(8); expect(at.getDate()).toBe(17)
  })
  it('does not change workout counts, day status or streak', () => {
    const S=state(), without={...S,measurementReminders:{}}
    expect(calendarDay(S,'2026-09-17').status).toBe('rest')
    expect(calendarPeriod(S,new Date('2026-09-17T12:00:00'),'week').counts).toEqual(calendarPeriod(without,new Date('2026-09-17T12:00:00'),'week').counts)
    expect(trainingStreak(S)).toEqual(trainingStreak(without))
    expect(measurementReminders(S,'2026-09-20')[0].status).toBe('Overdue')
  })
  it('completes only the metric actually recorded and moves its next cycle', () => {
    const S=state(); S.measurementReminders.items.waist={...S.measurementReminders.items.weight}
    S.bodyweight.push({d:'2026-09-17',w:79})
    expect(measurementEventsOn(S,'2026-09-17').find(r=>r.metric==='weight').status).toBe('Completed')
    expect(measurementEventsOn(S,'2026-09-17').find(r=>r.metric==='bodyMeasurements').status).not.toBe('Completed')
  })
  it('snoozes without changing frequency and drops stale snooze after recording', () => {
    const S=state(); postponeMeasurement(S,'weight',false,'2026-09-17')
    expect(measurementReminders(S)[0].due).toBe('2026-09-18')
    expect(S.measurementReminders.items.weight.intervalValue).toBe(1)
    S.bodyweight.push({d:'2026-09-17',w:81})
    expect(measurementReminders(S)[0].due).toBe('2026-09-24')
  })
  it('skips a cycle without marking a missed workout', () => {
    const S=state(); postponeMeasurement(S,'weight',true,'2026-09-17')
    expect(measurementReminders(S)[0].due).toBe('2026-09-24')
    expect(S.workouts).toEqual([])
  })
  it('groups metrics, preserves configuration in portable backups and disables cleanly', () => {
    const S=state(); S.measurementReminders.items.waist={...S.measurementReminders.items.weight,id:'measurement:waist'}
    const restored=readBackup(createBackup(S)), now=new Date('2026-09-10T12:00:00')
    expect(measurementNotificationPlan(restored,now)).toEqual(measurementNotificationPlan(S,now))
    expect(measurementNotificationPlan(S,now)).toHaveLength(1)
    expect(measurementNotificationPlan(S,now)[0].metrics).toEqual(['weight','bodyMeasurements'])
    restored.measurementReminders.items.weight.enabled=false
    restored.measurementReminders.items.waist.enabled=false
    expect(measurementNotificationPlan(restored,now)).toEqual([])
    expect(restored.bodyweight).toEqual(S.bodyweight)
  })
  it('cancels owned notification IDs before rescheduling on repeated restore and off', async () => {
    notificationMocks.cancel.mockClear(); notificationMocks.schedule.mockClear()
    const S=state(); S.measurementReminders.items.weight.anchorDate='2090-01-01'; S.bodyweight=[]
    await syncReminder(S); await syncReminder(readBackup(createBackup(S)))
    expect(notificationMocks.cancel).toHaveBeenCalledWith({notifications:MEASUREMENT_NOTIFICATION_IDS.map(id=>({id}))})
    const ids=notificationMocks.schedule.mock.calls.map(([batch])=>batch.notifications.map(n=>n.id))
    expect(ids[0]).toEqual(ids[1])
    notificationMocks.schedule.mockClear(); S.measurementReminders.notifications=false
    await syncReminder(S)
    expect(notificationMocks.schedule).not.toHaveBeenCalled()
  })
  it('offers exactly three categories without enabling suggested defaults', () => {
    const S = state(); S.measurementReminders.items = {}
    expect(REMINDER_METRICS.map(([key])=>key)).toEqual(['weight','bodySize','bodyMeasurements'])
    expect(measurementReminders(S)).toEqual([])
    expect(reminderConfig(S,'bodySize')).toMatchObject({enabled:false,intervalValue:1,intervalUnit:'months'})
    expect(reminderConfig(S,'bodyMeasurements')).toMatchObject({enabled:false,intervalValue:2,intervalUnit:'weeks'})
  })
  it('groups legacy circumference reminders and lets a partial session reset that category only', () => {
    const S = state()
    S.measurementReminders.items.waist = {...S.measurementReminders.items.weight}
    S.measurementReminders.items.chest = {...S.measurementReminders.items.weight,intervalValue:2}
    S.measurements.push({d:'2026-09-15',waist:82})
    expect(measurementReminders(S).map(r=>[r.metric,r.due])).toEqual([['weight','2026-09-17'],['bodyMeasurements','2026-09-22']])
    expect(S.measurementReminders.items.chest.intervalValue).toBe(2)
    postponeMeasurement(S,'bodyMeasurements',false,'2026-09-16')
    expect(measurementReminders(S).find(r=>r.metric==='bodyMeasurements').due).toBe('2026-09-17')
    expect(readBackup(createBackup(S)).measurementReminders).toEqual(S.measurementReminders)
  })
  it('uses a real recorded height date without inventing dates for legacy height', () => {
    const S = state(); S.heightCm = 170
    S.measurementReminders.items.bodySize = {enabled:true,intervalValue:1,intervalUnit:'months',anchorDate:'2026-09-10'}
    expect(measurementReminders(S).find(r=>r.metric==='bodySize').last).toBeNull()
    S.heightRecordedAt = '2026-09-15'
    expect(measurementReminders(S).find(r=>r.metric==='bodySize')).toMatchObject({last:'2026-09-15',due:'2026-10-15'})
    expect(measurementEventsOn(S,'2026-09-15').find(r=>r.metric==='bodySize').status).toBe('Completed')
    expect(readBackup(createBackup(S)).heightRecordedAt).toBe('2026-09-15')
  })
})

