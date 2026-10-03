import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest'
import {MEASUREMENT_NOTIFICATION_IDS} from './measurement-reminders.js'
import {WORKOUT_NOTIFICATION_IDS,DELOAD_NOTIFICATION_IDS} from './workout-reminders.js'

const native = vi.hoisted(() => {
  const pending = new Map()
  return {pending,
    cancel:vi.fn(async ({notifications}) => {for (const {id} of notifications) pending.delete(id)}),
    schedule:vi.fn(async ({notifications}) => {for (const notice of notifications) pending.set(notice.id,structuredClone(notice))}),
    getPending:vi.fn(async () => ({notifications:[...pending.values()]})),
    checkPermissions:vi.fn(async () => ({display:'granted'})),
    requestPermissions:vi.fn(async () => ({display:'granted'})),
    sounds:vi.fn(async () => ({channels:{silent:'silent',muted:'muted',audible:'audible'},notificationSoundsSupported:true})),
    finish:vi.fn(async () => {}),
  }
})
vi.mock('@capacitor/local-notifications',()=>({LocalNotifications:native}))
vi.mock('./native-sound.js',()=>({syncNativeSounds:native.sounds,finishNativeSoundSync:native.finish}))
let mobile
const state = () => ({accent:'lime',sound:true,routines:[{id:'a',name:'Upper'},{id:'b',name:'Lower'}],week:{4:['a'],5:['b']},dayPlan:{},workouts:[],bodyweight:[],measurements:[],reminder:{on:true,time:'08:00',nextTime:'19:00'},measurementReminders:{notifications:true,time:'09:00',items:{weight:{enabled:true,anchorDate:'2026-09-10',intervalUnit:'weeks',intervalValue:1}}},deload:{on:false,notifications:true}})
beforeEach(async () => {
  vi.resetModules();vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-10T07:00:00'))
  native.pending.clear();vi.clearAllMocks()
  native.cancel.mockImplementation(async ({notifications}) => {for (const {id} of notifications) native.pending.delete(id)})
  native.schedule.mockImplementation(async ({notifications}) => {for (const notice of notifications) native.pending.set(notice.id,structuredClone(notice))})
  native.getPending.mockImplementation(async () => ({notifications:[...native.pending.values()]}))
  native.checkPermissions.mockResolvedValue({display:'granted'})
  native.requestPermissions.mockImplementation(async () => {native.checkPermissions.mockResolvedValue({display:'granted'});return {display:'granted'}})
  native.sounds.mockResolvedValue({channels:{silent:'silent',muted:'muted',audible:'audible'},notificationSoundsSupported:true})
  mobile = await import('./mobile.js')
})
afterEach(()=>vi.useRealTimers())

describe('serialized, independently reconciled native reminders',()=>{
  it('does not recreate notifications for repeated saves, restores or concurrent foreground checks',async()=>{
    const S=state()
    expect(await Promise.all([mobile.syncReminder(S),mobile.syncReminder(structuredClone(S)),mobile.syncReminder(S)])).toEqual([true,true,true])
    expect(native.schedule).toHaveBeenCalledTimes(2)
    expect(native.pending.size).toBe(3)
    expect(mobile.getReminderStatus()).toMatchObject({workout:{status:'configured',count:2},measurement:{status:'configured',count:1},deload:{status:'off'}})
    expect(mobile.getReminderStatus().measurement.nextAt).toBe(new Date('2026-09-17T09:00:00').toISOString())
    expect(native.requestPermissions).not.toHaveBeenCalled()
    const snapshot=mobile.getReminderStatus(),listener=vi.fn(),unsubscribe=mobile.subscribeReminderStatus(listener)
    await mobile.syncReminder(S)
    expect(mobile.getReminderStatus()).toBe(snapshot);expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })
  it('edits and toggles measurements without cancelling workout/deload or discarding preferences',async()=>{
    const S=state();S.deload={on:true,notifications:true,startDate:'2026-08-03',normalWeeks:6}
    await mobile.syncReminder(S)
    const workout=native.pending.get(100),deload=native.pending.get(DELOAD_NOTIFICATION_IDS[0])
    native.cancel.mockClear();native.schedule.mockClear()
    S.measurementReminders.time='10:15';await mobile.syncReminder(S)
    expect(native.cancel).toHaveBeenCalledTimes(1)
    expect(native.cancel).toHaveBeenLastCalledWith({notifications:MEASUREMENT_NOTIFICATION_IDS.map(id=>({id}))})
    expect(native.pending.get(100)).toEqual(workout);expect(native.pending.get(DELOAD_NOTIFICATION_IDS[0])).toEqual(deload)
    const preferences=JSON.stringify(S.measurementReminders.items)
    S.measurementReminders.notifications=false;await mobile.syncReminder(S)
    expect(mobile.getReminderStatus().measurement.status).toBe('off');expect(native.pending.has(2000)).toBe(false)
    expect(JSON.stringify(S.measurementReminders.items)).toBe(preferences)
    S.measurementReminders.notifications=true;await mobile.syncReminder(S)
    expect([...native.pending.keys()].filter(id=>MEASUREMENT_NOTIFICATION_IDS.includes(id))).toEqual([2000])
    expect(native.pending.get(100)).toEqual(workout)
  })
  it('replaces changed schedules and removes completed or deleted planned workout notices',async()=>{
    const S=state();await mobile.syncReminder(S)
    const measurement=native.pending.get(2000)
    S.reminder.time='10:00';await mobile.syncReminder(S)
    expect(new Date(native.pending.get(100).schedule.at).getHours()).toBe(10)
    S.workouts=[{id:'completed',sessionOrigin:{type:'planned',routineId:'a'},d:'2026-09-10',entries:[{id:'edited',sets:[{done:true,r:6}]}]}]
    await mobile.syncReminder(S);expect(native.pending.has(100)).toBe(false)
    S.routines=[];await mobile.syncReminder(S)
    expect([...native.pending.keys()].some(id=>WORKOUT_NOTIFICATION_IDS.includes(id))).toBe(false)
    expect(mobile.getReminderStatus().workout.status).toBe('incomplete')
    expect(native.pending.get(2000)).toEqual(measurement)
  })
  it('keeps the latest of rapid changes and disables only the requested type',async()=>{
    const S=state(),first=mobile.syncReminder(S)
    const edited=structuredClone(S);edited.measurementReminders.time='11:30'
    const second=mobile.syncReminder(edited);edited.measurementReminders.notifications=false
    const third=mobile.syncReminder(edited)
    await Promise.all([first,second,third])
    expect(native.pending.has(2000)).toBe(false);expect(native.pending.has(100)).toBe(true)
    expect(mobile.getReminderStatus().measurement.status).toBe('off')
  })
  it('does not ask permissions on background sync or repeatedly after denial',async()=>{
    const S=state();native.checkPermissions.mockResolvedValue({display:'denied'})
    expect(await mobile.syncReminder(S)).toBe(false);expect(await mobile.syncReminder(S,true,'measurement')).toBe(false)
    expect(native.requestPermissions).not.toHaveBeenCalled();expect(native.schedule).not.toHaveBeenCalled()
    expect(mobile.getReminderStatus()).toMatchObject({workout:{status:'permission-denied'},measurement:{status:'permission-denied'}})
    native.checkPermissions.mockResolvedValue({display:'prompt'})
    await mobile.syncReminder(S);expect(native.requestPermissions).not.toHaveBeenCalled()
    await mobile.syncReminder(S,true,'measurement');await mobile.syncReminder(S,true,'measurement')
    expect(native.requestPermissions).toHaveBeenCalledTimes(1)
    expect(mobile.getReminderStatus().measurement.status).toBe('configured')
  })
  it('reports a failed family without blocking others and safely retries without duplicates',async()=>{
    const S=state(),normal=native.schedule.getMockImplementation()
    native.schedule.mockImplementationOnce(normal).mockRejectedValueOnce(new Error('alarm unavailable'))
    expect(await mobile.syncReminder(S,false,'measurement')).toBe(false)
    expect(mobile.getReminderStatus()).toMatchObject({workout:{status:'configured'},measurement:{status:'error',count:0}})
    expect(native.pending.has(100)).toBe(true);expect(native.pending.has(2000)).toBe(false)
    native.cancel.mockClear();await mobile.syncReminder(S,false,'measurement')
    expect(native.cancel).toHaveBeenCalledTimes(1)
    expect(native.pending.size).toBe(3);expect(mobile.getReminderStatus().measurement.status).toBe('configured')
  })
  it('does not confirm activation or cancellation unless the native pending list agrees',async()=>{
    const S=state();native.schedule.mockResolvedValueOnce({})
    const activating=mobile.syncReminder(S,false,'workout')
    await vi.waitFor(()=>expect(native.schedule).toHaveBeenCalledTimes(1))
    await vi.advanceTimersByTimeAsync(400)
    expect(await activating).toBe(false)
    expect(mobile.getReminderStatus().workout.status).toBe('error')
    await mobile.syncReminder(S)
    S.measurementReminders.notifications=false;native.cancel.mockRejectedValueOnce(new Error('cancel failed'))
    expect(await mobile.syncReminder(S,false,'measurement')).toBe(false)
    expect(mobile.getReminderStatus().measurement.status).toBe('error');expect(native.pending.has(2000)).toBe(true)
    expect(await mobile.syncReminder(S,false,'measurement')).toBe(true)
    expect(native.pending.has(2000)).toBe(false)
  })
  it('recognizes pending reminders after module reload, including Android Java Date timezone text',async()=>{
    const S=state();await mobile.syncReminder(S)
    for(const notice of native.pending.values()) notice.schedule.at='Thu Sep 17 09:00:00 AST 2026'
    native.cancel.mockClear();native.schedule.mockClear();vi.resetModules();mobile=await import('./mobile.js')
    expect(await mobile.syncReminder(S)).toBe(true)
    expect(native.cancel).not.toHaveBeenCalled();expect(native.schedule).not.toHaveBeenCalled()
    native.sounds.mockResolvedValue({channels:{silent:'silent',muted:'muted',audible:'audible-new'},notificationSoundsSupported:true})
    await mobile.syncReminder(S)
    expect(native.schedule).toHaveBeenCalledTimes(2)
  })
  it('reconciles revoked permission and invalid settings without claiming old pending alerts are operational',async()=>{
    const S=state();await mobile.syncReminder(S)
    native.checkPermissions.mockResolvedValue({display:'denied'});await mobile.syncReminder(S)
    expect(native.pending.size).toBe(0);expect(mobile.getReminderStatus().measurement.status).toBe('permission-denied')
    native.checkPermissions.mockResolvedValue({display:'granted'});S.measurementReminders.time='25:00'
    expect(await mobile.syncReminder(S,false,'workout')).toBe(true)
    expect(mobile.getReminderStatus()).toMatchObject({workout:{status:'configured'},measurement:{status:'incomplete'}})
  })
  it('keeps legacy IDs disjoint and removes obsolete owned IDs without touching foreign notifications',async()=>{
    native.pending.set(100,{id:100});native.pending.set(2004,{id:2004});native.pending.set(3000,{id:3000});native.pending.set(9000,{id:9000})
    const S=state();await mobile.syncReminder(S)
    expect(native.pending.has(3000)).toBe(false);expect(native.pending.has(2004)).toBe(false);expect(native.pending.has(9000)).toBe(true)
    const all=[...WORKOUT_NOTIFICATION_IDS,...MEASUREMENT_NOTIFICATION_IDS,...DELOAD_NOTIFICATION_IDS]
    expect(new Set(all).size).toBe(all.length)
  })
  it('reports configured with zero future notices rather than inventing overdue notifications',async()=>{
    const S=state();S.reminder.on=false;S.measurementReminders.items.weight.anchorDate='2026-08-01'
    expect(await mobile.syncReminder(S)).toBe(true)
    expect(mobile.getReminderStatus().measurement).toMatchObject({status:'configured',count:0,nextAt:null})
    expect(native.schedule).not.toHaveBeenCalled()
  })
  it('preserves old native sound resources after a cancellation failure even if the requested family succeeded',async()=>{
    const S=state();await mobile.syncReminder(S)
    const oldMeasurement=native.pending.get(2000),cancel=native.cancel.getMockImplementation()
    native.finish.mockClear()
    native.sounds.mockResolvedValue({channels:{silent:'silent',muted:'muted',audible:'audible-new'},notificationSoundsSupported:true})
    native.cancel.mockImplementationOnce(cancel).mockRejectedValueOnce(new Error('cannot cancel measurements'))
    expect(await mobile.syncReminder(S,false,'workout')).toBe(true)
    expect(mobile.getReminderStatus()).toMatchObject({workout:{status:'configured'},measurement:{status:'error'}})
    expect(native.pending.get(2000)).toEqual(oldMeasurement)
    expect(native.finish).not.toHaveBeenCalled()
    await mobile.syncReminder(S)
    expect(native.pending.get(2000).channelId).toBe('audible-new')
    expect(native.finish).toHaveBeenCalledTimes(1)
  })
  it('does not prune prior channels when replacement scheduling fails',async()=>{
    const S=state();await mobile.syncReminder(S)
    native.finish.mockClear()
    native.sounds.mockResolvedValue({channels:{silent:'silent',muted:'muted',audible:'audible-new'},notificationSoundsSupported:true})
    const schedule=native.schedule.getMockImplementation()
    native.schedule.mockImplementationOnce(schedule).mockRejectedValueOnce(new Error('alarm unavailable'))
    expect(await mobile.syncReminder(S)).toBe(false)
    expect(mobile.getReminderStatus().measurement.status).toBe('error')
    expect(native.finish).not.toHaveBeenCalled()
  })
  it('does not prune prior channels when native pending verification is unavailable',async()=>{
    const S=state();await mobile.syncReminder(S)
    const oldPending=[...native.pending.values()]
    native.finish.mockClear()
    native.sounds.mockResolvedValue({channels:{silent:'silent',muted:'muted',audible:'audible-new'},notificationSoundsSupported:true})
    native.getPending.mockRejectedValueOnce(new Error('cannot read pending alarms'))
    expect(await mobile.syncReminder(S)).toBe(false)
    expect([...native.pending.values()]).toEqual(oldPending)
    expect(native.finish).not.toHaveBeenCalled()
    expect(await mobile.syncReminder(S)).toBe(true)
    expect(native.finish).toHaveBeenCalledTimes(1)
  })
  it('waits for delayed native scheduling with bounded read-only verification',async()=>{
    const S=state();S.measurementReminders.notifications=false
    const schedule=native.schedule.getMockImplementation()
    native.schedule.mockImplementationOnce(batch=>{setTimeout(()=>schedule(batch),300);return Promise.resolve({})})
    const syncing=mobile.syncReminder(S)
    await vi.waitFor(()=>expect(native.getPending).toHaveBeenCalledTimes(2))
    await vi.advanceTimersByTimeAsync(400)
    expect(await syncing).toBe(true)
    expect(native.getPending).toHaveBeenCalledTimes(4)
    expect(native.cancel).toHaveBeenCalledTimes(1);expect(native.schedule).toHaveBeenCalledTimes(1)
    expect(mobile.getReminderStatus().workout).toMatchObject({status:'configured',count:2})
  })
  it('waits for delayed native cancellation without issuing a second cancel',async()=>{
    const S=state();S.measurementReminders.notifications=false;await mobile.syncReminder(S)
    const cancel=native.cancel.getMockImplementation()
    vi.clearAllMocks()
    native.cancel.mockImplementationOnce(batch=>{setTimeout(()=>cancel(batch),300);return Promise.resolve({})})
    S.reminder.on=false
    const syncing=mobile.syncReminder(S)
    await vi.waitFor(()=>expect(native.getPending).toHaveBeenCalledTimes(2))
    await vi.advanceTimersByTimeAsync(400)
    expect(await syncing).toBe(true)
    expect(native.getPending).toHaveBeenCalledTimes(4)
    expect(native.cancel).toHaveBeenCalledTimes(1);expect(native.schedule).not.toHaveBeenCalled()
    expect(mobile.getReminderStatus().workout.status).toBe('off');expect(native.pending.size).toBe(0)
  })
  it('stops after three verification reads if native scheduling remains unconfirmed',async()=>{
    const S=state();S.measurementReminders.notifications=false
    native.schedule.mockResolvedValueOnce({})
    const syncing=mobile.syncReminder(S)
    await vi.waitFor(()=>expect(native.getPending).toHaveBeenCalledTimes(2))
    await vi.advanceTimersByTimeAsync(400)
    expect(await syncing).toBe(false)
    expect(native.getPending).toHaveBeenCalledTimes(4)
    expect(native.cancel).toHaveBeenCalledTimes(1);expect(native.schedule).toHaveBeenCalledTimes(1)
    expect(mobile.getReminderStatus().workout.status).toBe('error')
    expect(native.finish).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0)
  })
  it('reports a failed pending read immediately instead of retrying native errors',async()=>{
    const S=state(),getPending=native.getPending.getMockImplementation()
    native.getPending.mockImplementationOnce(getPending).mockRejectedValueOnce(new Error('cannot read pending'))
    expect(await mobile.syncReminder(S)).toBe(false)
    expect(native.getPending).toHaveBeenCalledTimes(2)
    expect(mobile.getReminderStatus().workout.status).toBe('error')
    expect(native.finish).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0)
  })
})
