import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest'
import {MEASUREMENT_NOTIFICATION_IDS} from './measurement-reminders.js'
import {WORKOUT_NOTIFICATION_IDS,DELOAD_NOTIFICATION_IDS} from './workout-reminders.js'
import es from '../locales/es.js'

const native = vi.hoisted(() => {
  const pending = new Map()
  return {pending,
    cancel:vi.fn(async ({notifications}) => {for (const {id} of notifications) pending.delete(id)}),
    schedule:vi.fn(async ({notifications}) => {for (const notice of notifications) pending.set(notice.id,structuredClone(notice))}),
    getPending:vi.fn(async () => ({notifications:[...pending.values()]})),
    checkPermissions:vi.fn(async () => ({display:'granted'})),
    requestPermissions:vi.fn(async () => ({display:'granted'})),
    sounds:vi.fn(async () => ({channels:{silent:'silent',muted:'muted',audible:'audible'},notificationSoundsSupported:true})),
    fallback:vi.fn(async()=>({channels:{silent:'fallback-quiet',muted:'fallback-muted',audible:'fallback-muted'},notificationSoundsSupported:true})),
    finish:vi.fn(async () => {}),
  }
})
vi.mock('@capacitor/local-notifications',()=>({LocalNotifications:native}))
vi.mock('./native-sound.js',()=>({syncNativeSounds:native.sounds,finishNativeSoundSync:native.finish,fallbackNativeSounds:native.fallback}))
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
  native.fallback.mockResolvedValue({channels:{silent:'fallback-quiet',muted:'fallback-muted',audible:'fallback-muted'},notificationSoundsSupported:true})
  mobile = await import('./mobile.js')
})
afterEach(()=>vi.useRealTimers())

describe('serialized, independently reconciled native reminders',()=>{
  it.each([['en',{},'Today','Tomorrow'],['es',es,'Hoy','Mañana']])('uses %s weekly relative text and preserves explicit dated plans and scheduling payloads',async(lang,dict,today,tomorrow)=>{
    const {_setLangState,t}=await import('./i18n-core.js'),{fmtScheduledDate}=await import('./format.js')
    _setLangState(lang,dict)
    const S=state(),before=structuredClone(S)
    S.measurementReminders.notifications=false;before.measurementReminders.notifications=false
    expect(await mobile.syncReminder(S)).toBe(true)
    expect(native.pending.get(100).body).toBe(t('{0} is scheduled for {1}.','Upper',today))
    expect(native.pending.get(101).body).toBe(t('{0} is scheduled for {1}.','Lower',tomorrow))
    const original=[native.pending.get(100),native.pending.get(101)].map(notice=>structuredClone(notice))
    expect(native.cancel).toHaveBeenCalledExactlyOnceWith({notifications:[...WORKOUT_NOTIFICATION_IDS,3000].map(id=>({id}))})
    native.cancel.mockClear();native.schedule.mockClear()
    expect(await mobile.syncReminder(S)).toBe(true)
    expect(native.cancel).not.toHaveBeenCalled();expect(native.schedule).not.toHaveBeenCalled()
    expect(mobile.getReminderStatus().workout.nextDate).toBe('2026-09-10')
    S.dayPlan={'2026-09-10':['a'],'2026-09-11':['b']}
    expect(await mobile.syncReminder(S)).toBe(true)
    for(const previous of original){
      const actual=native.pending.get(previous.id),{body:oldText,...oldPayload}=previous,{body:newText,...newPayload}=actual
      expect(newPayload).toEqual(oldPayload)
      expect(newText).toBe(t('{0} is scheduled for {1}.',previous.id===100?'Upper':'Lower',fmtScheduledDate(previous.extra.date)))
      expect(newText).not.toBe(oldText)
    }
    expect(S).toEqual({...before,dayPlan:{'2026-09-10':['a'],'2026-09-11':['b']}})
    _setLangState('en',{})
  })
  it('formats a future native reminder relative to its firing date and preserves its existing metadata',async()=>{
    const plans=await import('./workout-reminders.js')
    const at=new Date('2026-09-12T19:00:00'),notice={id:101,kind:'next',routineId:'b',name:'Lower',remaining:1,date:'2026-09-13',at}
    const spy=vi.spyOn(plans,'workoutNotificationPlan').mockReturnValue([notice])
    try{
      const S=state();S.measurementReminders.notifications=false
      expect(await mobile.syncReminder(S)).toBe(true)
      expect(native.pending.get(101)).toMatchObject({id:101,title:'Next workout reminder',body:'Lower is scheduled for Tomorrow.',schedule:{at,allowWhileIdle:true},extra:{type:'workout',routineId:'b',date:'2026-09-13',tgymReminderAt:+at}})
      expect(native.pending.size).toBe(1)
    }finally{spy.mockRestore()}
  })
  it('captures only reminder inputs, never reading unrelated media, while keeping complete legacy rows',async()=>{
    const S=state(),readMedia=vi.fn(()=>{throw new Error('Unrelated media must not be read')})
    for(const key of ['customEx','profile','inbody','equipProfiles'])Object.defineProperty(S,key,{enumerable:true,get:readMedia})
    S.active={id:'live',entries:[{id:'legacy',sets:[{done:false,r:8}]}]}
    S.workouts=[{id:'historic',d:'2026-09-03',routineId:'a',name:'Upper',legacyUnknown:{keep:true},entries:[{id:'legacy',sets:[{done:true,r:8,mode:'reps'}]}]}]
    const original=structuredClone(S.workouts),syncing=mobile.syncReminder(S)
    S.reminder.time='10:30';S.workouts[0].legacyUnknown.keep=false
    expect(await syncing).toBe(true);expect(readMedia).not.toHaveBeenCalled()
    const snapshot=native.sounds.mock.calls[0][0]
    expect(snapshot.reminder.time).toBe('08:00');expect(snapshot.workouts).toEqual(original)
    expect(snapshot.active).toEqual(S.active);expect(snapshot.routines).toEqual(S.routines)
    for(const key of ['customEx','profile','inbody','equipProfiles'])expect(Object.hasOwn(snapshot,key)).toBe(false)
    expect(native.pending.size).toBe(3)
  })
  it('silences notification audio without disabling or duplicating delivery and preserves master mute',async()=>{
    const S=state();S.notificationSoundOn=false
    expect(await mobile.syncReminder(S)).toBe(true)
    expect(native.pending.size).toBe(3);expect([...native.pending.values()].every(n=>n.channelId==='muted')).toBe(true)
    native.schedule.mockClear();await mobile.syncReminder(S);expect(native.schedule).not.toHaveBeenCalled()
    S.notificationSoundOn=true;S.soundMuted=true;await mobile.syncReminder(S)
    expect(native.pending.size).toBe(3);expect([...native.pending.values()].every(n=>n.channelId==='muted')).toBe(true)
    expect(S.reminder.on).toBe(true);expect(S.measurementReminders.notifications).toBe(true)
  })
  it('keeps delivery with explicit silent fallback after sound configuration fails, then safely recovers',async()=>{
    const S=state();await mobile.syncReminder(S);native.finish.mockClear()
    native.sounds.mockRejectedValueOnce(new Error('file unavailable'))
    expect(await mobile.syncReminder(S)).toBe(true)
    expect(native.fallback).toHaveBeenCalledWith(S);expect(native.pending.size).toBe(3)
    expect([...native.pending.values()].every(n=>n.channelId==='fallback-muted')).toBe(true)
    expect(mobile.getReminderStatus().measurement).toMatchObject({status:'configured',count:1,error:'Notifications are scheduled without sound. The selected sound could not be applied.'})
    expect(native.finish).not.toHaveBeenCalled()
    expect(await mobile.syncReminder(S)).toBe(true)
    expect(native.pending.size).toBe(3);expect(mobile.getReminderStatus().measurement.error).toBeNull();expect(native.finish).toHaveBeenCalledOnce()
  })
  it('retains existing alarms when sound and fallback channels both fail, while an explicit off still cancels',async()=>{
    const S=state();await mobile.syncReminder(S);const before=[...native.pending.values()]
    native.finish.mockClear();native.cancel.mockClear();native.schedule.mockClear()
    native.sounds.mockRejectedValue(new Error('file unavailable'));native.fallback.mockRejectedValue(new Error('channels unavailable'))
    expect(await mobile.syncReminder(S)).toBe(false)
    expect([...native.pending.values()]).toEqual(before);expect(native.cancel).not.toHaveBeenCalled();expect(native.finish).not.toHaveBeenCalled()
    S.measurementReminders.notifications=false;await mobile.syncReminder(S)
    expect(native.pending.has(2000)).toBe(false);expect(native.pending.size).toBe(2);expect(mobile.getReminderStatus().measurement.status).toBe('off')
  })
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
