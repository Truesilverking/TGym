// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore, DEF } from './useStore.js'
import { workoutElapsedMs, resumeWorkoutClock } from '../lib/workout-time.js'
import { encodeSound, soundChoice } from '../lib/sound-preferences.js'

const native = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn(), reminder: vi.fn(), clock:vi.fn(), journalAvailable:true }))
vi.mock('../lib/mobile.js', () => ({
  MOBILE: true, nativeLoad: native.load, nativeSave: native.save,
  nativeClockJournalAvailable:()=>native.journalAvailable, nativeSaveClockJournal:native.clock,
  syncReminder: native.reminder, writeAutoBackup: vi.fn(),
}))
vi.mock('../lib/remote.js', () => ({ loadRemote: async () => null, chooseLocal: vi.fn(), forgetRemote: vi.fn(), connect: vi.fn() }))

const minute = 60000
const completed = () => ({ id: 'restored', start: 360 * minute, entries: [{ id: 'ex', sets: [{ done: true, doneAt: 432 * minute }] }] })
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(540 * minute)
  vi.clearAllMocks()
  native.journalAvailable=true;native.clock.mockResolvedValue(true)
  localStorage.clear()
  useStore.setState({ S: structuredClone(DEF), user: null, ready: false })
})
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })

it('boots from the native mirror after WebView storage loss and immediately persists the repaired pause', async () => {
  native.load.mockResolvedValue({ ...structuredClone(DEF), _ts: 432 * minute, active: completed() })
  await useStore.getState().boot()
  const saved = JSON.parse(localStorage.getItem('gym_state_v1'))
  expect(useStore.getState().ready).toBe(true)
  expect(saved.active.timerPausedAt).toBe(432 * minute)
  expect(workoutElapsedMs(saved.active)).toBe(72 * minute)
  expect(native.save).toHaveBeenCalledOnce()
  expect(native.save.mock.calls[0][0].active.timerPausedAt).toBe(432 * minute)
})

it('offline native reopen pauses an unfinished session at the persisted thirty-minute boundary', async () => {
  const active={id:'unfinished',start:360*minute,lastUserInteractionAt:400*minute,entries:[{id:'ex',sets:[{done:true,r:8,doneAt:400*minute},{done:false,r:8}]}]}
  native.load.mockResolvedValue({...structuredClone(DEF),_ts:400*minute,active})
  native.save.mockResolvedValue(true)
  await useStore.getState().boot()
  const saved=JSON.parse(localStorage.getItem('gym_state_v1'))
  expect(saved.active).toMatchObject({id:active.id,timerPausedAt:430*minute,pauseReason:'inactivity',accumulatedActiveDuration:70*minute})
  expect(saved.active.entries).toEqual(active.entries)
  expect(saved.workouts).toEqual([])
  expect(native.save.mock.calls.at(-1)[0].active.timerPausedAt).toBe(430*minute)
})
it('keeps planned and extra origins through native flush and WebView storage recovery',async()=>{
 native.save.mockResolvedValue(true)
 const planned={id:'planned',routineId:'r',sessionOrigin:{type:'planned',routineId:'r'},entries:[{id:'added',sets:[{done:true,r:8}]}]}
 const extra={...planned,id:'extra',routineId:null,sessionOrigin:{type:'extra',routineId:null}}
 useStore.getState().update(s=>{s.workouts=[planned,extra]})
 await useStore.getState().flushPersistence()
 const disk=JSON.parse(JSON.stringify(native.save.mock.calls.at(-1)[0]))
 localStorage.clear();useStore.setState({S:structuredClone(DEF),ready:false});native.load.mockResolvedValue(disk)
 await useStore.getState().boot()
 expect(useStore.getState().S.workouts.map(w=>w.sessionOrigin)).toEqual([planned.sessionOrigin,extra.sessionOrigin])
 expect(JSON.parse(localStorage.getItem('gym_state_v1')).workouts.map(w=>w.sessionOrigin.type)).toEqual(['planned','extra'])
})

it('writes final completion and Continue without waiting for the native debounce', () => {
  const active = completed()
  active.entries[0].sets[0].done = false
  useStore.setState({ S: { ...structuredClone(DEF), active } })
  vi.setSystemTime(432 * minute)
  useStore.getState().update(s => { s.active.entries[0].sets[0].done = true })
  expect(native.save).toHaveBeenCalledOnce()
  vi.setSystemTime(540 * minute)
  useStore.getState().update(s => { s.active = resumeWorkoutClock(s.active) })
  expect(native.save).toHaveBeenCalledTimes(2)
  const saved = native.save.mock.calls[1][0]
  expect(saved.active.timerPausedAt).toBeUndefined()
  expect(workoutElapsedMs(saved.active, 541 * minute)).toBe(73 * minute)
})

it('flushes body data and restores images and IDs after closing with WebView storage loss',async()=>{
 const inbody=[{id:'report',d:'2026-09-01',weight:80,image:'data:image/jpeg;base64,AA'}]
 const measurements=[{id:'measure',d:'2026-09-01',arm:30,waist:80}]
 native.save.mockResolvedValue(true)
 useStore.getState().update(s=>{s.inbody=inbody;s.measurements=measurements})
 await useStore.getState().flushPersistence()
 const disk=JSON.parse(JSON.stringify(native.save.mock.calls.at(-1)[0]))
 localStorage.clear()
 useStore.setState({S:structuredClone(DEF),ready:false})
 native.load.mockResolvedValue(disk)
 await useStore.getState().boot()
 expect(useStore.getState().S.inbody).toEqual(inbody)
 expect(useStore.getState().S.measurements).toEqual(measurements)
 expect(useStore.getState().needsMobileOnboarding).toBe(false)
})
it('reports a failed durable save and retains the local copy for retry',async()=>{
 native.save.mockResolvedValue(false)
 useStore.getState().update(s=>{s.inbody=[{id:'safe',d:'2026-09-01',image:'photo'}]})
 await expect(useStore.getState().flushPersistence()).rejects.toThrow('Native storage unavailable')
 expect(JSON.parse(localStorage.getItem('gym_state_v1')).inbody[0].id).toBe('safe')
 native.save.mockResolvedValue(true)
 await expect(useStore.getState().flushPersistence()).resolves.toBeUndefined()
})

it('restores an active training break from the native mirror after reopening',async()=>{
 const trainingPauses=[{id:'break',start:'2026-01-12',end:null}]
 native.save.mockResolvedValue(true)
 useStore.getState().update(s=>{s.trainingPauses=trainingPauses})
 await useStore.getState().flushPersistence()
 const disk=JSON.parse(JSON.stringify(native.save.mock.calls.at(-1)[0]))
 localStorage.clear()
 useStore.setState({S:structuredClone(DEF),ready:false})
 native.load.mockResolvedValue(disk)
 await useStore.getState().boot()
 expect(useStore.getState().S.trainingPauses).toEqual(trainingPauses)
 expect(useStore.getState().needsMobileOnboarding).toBe(false)
})

it('restores confirmed training history and estimates from the native mirror',async()=>{
 const trainingHistory={trackedFrom:'2026-01-12',historicalWorkouts:100,workoutsPerWeek:3,source:'user-estimate'}
 native.save.mockResolvedValue(true)
 useStore.getState().update(s=>{s.trainingStartDate='2025-01-01';s.trainingHistory=trainingHistory})
 await useStore.getState().flushPersistence()
 const disk=JSON.parse(JSON.stringify(native.save.mock.calls.at(-1)[0]))
 localStorage.clear();useStore.setState({S:structuredClone(DEF),ready:false});native.load.mockResolvedValue(disk)
 await useStore.getState().boot()
 expect(useStore.getState().S.trainingStartDate).toBe('2025-01-01')
 expect(useStore.getState().S.trainingHistory).toEqual(trainingHistory)
})

it('restores imported sound bytes and all sound choices after closing and losing WebView storage', async () => {
  const clip = { id: 'custom_saved', name: 'My chime', data: encodeSound(new Float32Array([.1, -.1, 0])), duration: 3 / 16000 }
  native.save.mockResolvedValue(true)
  useStore.getState().update(s => { s.customSounds = [clip]; s.sounds.rest = clip.id; s.sounds.notification = clip.id; s.sounds.countdown = 'silent' })
  await useStore.getState().flushPersistence()
  const disk = JSON.parse(JSON.stringify(native.save.mock.calls.at(-1)[0]))
  localStorage.clear(); useStore.setState({ S: structuredClone(DEF), ready: false }); native.load.mockResolvedValue(disk)
  await useStore.getState().boot()
  const restored = useStore.getState().S
  expect(soundChoice(restored, 'rest')).toEqual(clip)
  expect(soundChoice(restored, 'notification')).toEqual(clip)
  expect(restored.sounds.countdown).toBe('silent')
  expect(JSON.parse(localStorage.getItem('gym_state_v1')).customSounds).toEqual([clip])
})

it('reuses the exact confirmed primary serialization and refuses it for another state identity',async()=>{
 native.save.mockResolvedValue(true)
 useStore.getState().update(s=>{s.active={id:'cache',start:Date.now(),lastUserInteractionAt:Date.now(),entries:[]};s.customEx=[{id:'custom',img:'data:image/gif;base64,large'}]})
 const current=useStore.getState().S,confirmed=localStorage.getItem('gym_state_v1')
 await vi.advanceTimersByTimeAsync(800)
 expect(native.save.mock.calls.at(-1)).toEqual([current,confirmed])
 useStore.setState({S:{...current,active:{...current.active,note:'other identity'}}})
 await useStore.getState().flushPersistence()
 expect(native.save.mock.calls.at(-1)[0]).toBe(useStore.getState().S)
 expect(native.save.mock.calls.at(-1)[1]).toBe(JSON.stringify(useStore.getState().S))
 expect(native.save.mock.calls.at(-1)[1]).not.toBe(confirmed)
})

it('keeps an ordinary reminder edit pending across metadata saves and skips later clock-only reconciliation',async()=>{
 native.save.mockResolvedValue(true)
 useStore.setState({S:{...structuredClone(DEF),active:{id:'metadata',start:Date.now(),lastUserInteractionAt:Date.now(),entries:[]}}})
 await useStore.getState().flushPersistence();vi.clearAllMocks()
 useStore.getState().update(s=>{s.reminder.time='10:30'})
 await vi.advanceTimersByTimeAsync(200)
 useStore.getState().recordInteraction()
 await vi.advanceTimersByTimeAsync(800)
 expect(native.reminder).toHaveBeenCalledOnce()
 expect(native.reminder.mock.calls[0][0].reminder.time).toBe('10:30')
 const firstTimestamp=native.save.mock.calls[0][0].active.lastUserInteractionAt
 useStore.getState().recordInteraction()
 await vi.advanceTimersByTimeAsync(800)
 expect(native.reminder).toHaveBeenCalledOnce();expect(native.save).toHaveBeenCalledTimes(2)
 expect(native.save.mock.calls[1][0].active.lastUserInteractionAt).toBeGreaterThan(firstTimestamp)
 expect(native.save.mock.calls[1][1]).toBe(localStorage.getItem('gym_state_v1'))
})

it('flushes pending ordinary reminder edits on background once and cancels the delayed work',async()=>{
 native.save.mockResolvedValue(true)
 useStore.setState({S:{...structuredClone(DEF),active:{id:'background',start:Date.now(),lastUserInteractionAt:Date.now(),entries:[]}}})
 await useStore.getState().flushPersistence();vi.clearAllMocks()
 useStore.getState().update(s=>{s.reminder.time='11:45'})
 useStore.getState().recordInteraction(Date.now(),{defer:true})
 window.dispatchEvent(new Event('pagehide'))
 expect(native.reminder).toHaveBeenCalledOnce();expect(native.save).toHaveBeenCalledOnce()
 expect(native.reminder.mock.calls[0][0].reminder.time).toBe('11:45')
 expect(native.save.mock.calls[0][1]).toBe(localStorage.getItem('gym_state_v1'))
 await vi.advanceTimersByTimeAsync(2500)
 expect(native.reminder).toHaveBeenCalledOnce();expect(native.save).toHaveBeenCalledOnce()
})

it('never reuses the serialization of a failed newer draft',async()=>{
 native.save.mockResolvedValue(true)
 useStore.getState().update(s=>{s.active={id:'approved',start:Date.now(),lastUserInteractionAt:Date.now(),entries:[]}})
 await vi.advanceTimersByTimeAsync(800)
 const approved=useStore.getState().S,confirmed=localStorage.getItem('gym_state_v1'),original=localStorage.setItem
 const write=vi.spyOn(localStorage,'setItem').mockImplementation(function(key,value){if(key==='gym_state_v1')throw new Error('disk unavailable');return original.call(this,key,value)})
 try{expect(()=>useStore.getState().update(s=>{s.active.note='uncommitted'})).toThrow('disk unavailable')}
 finally{write.mockRestore()}
 await useStore.getState().flushPersistence()
 expect(useStore.getState().S).toBe(approved)
 expect(native.save.mock.calls.at(-1)).toEqual([approved,confirmed])
 expect(JSON.parse(native.save.mock.calls.at(-1)[1]).active.note).toBeUndefined()
})

it('persists background clock-only input without requesting another reminder reconciliation',async()=>{
 native.save.mockResolvedValue(true)
 useStore.setState({S:{...structuredClone(DEF),active:{id:'clock-only',start:Date.now(),lastUserInteractionAt:Date.now(),entries:[]}}})
 await useStore.getState().flushPersistence();vi.clearAllMocks()
 await vi.advanceTimersByTimeAsync(50)
 const captured=Date.now()
 useStore.getState().recordInteraction(captured,{defer:true})
 window.dispatchEvent(new Event('pagehide'))
 expect(native.save).toHaveBeenCalledOnce();expect(native.reminder).not.toHaveBeenCalled()
 expect(JSON.parse(native.save.mock.calls[0][1]).active.lastUserInteractionAt).toBe(captured)
 await vi.advanceTimersByTimeAsync(2500)
 expect(native.save).toHaveBeenCalledOnce();expect(native.reminder).not.toHaveBeenCalled()
})

it('flushes extended gesture metadata to the native mirror immediately on pagehide',async()=>{
 native.save.mockResolvedValue(true)
 useStore.setState({S:{...structuredClone(DEF),active:{id:'gesture-quiet',start:Date.now(),lastUserInteractionAt:Date.now(),entries:[]}}})
 await useStore.getState().flushPersistence();vi.clearAllMocks()
 await vi.advanceTimersByTimeAsync(50)
 const captured=Date.now()
 useStore.getState().recordInteraction(captured,{defer:true,quietMs:1800})
 await vi.advanceTimersByTimeAsync(800)
 expect(native.save).not.toHaveBeenCalled()
 expect(useStore.getState().reconcileActiveClock(Date.now()).lastUserInteractionAt).toBe(captured)
 window.dispatchEvent(new Event('pagehide'))
 expect(native.save).toHaveBeenCalledOnce();expect(native.reminder).not.toHaveBeenCalled()
 const saved=JSON.parse(localStorage.getItem('gym_state_v1'))
 expect(saved.active.lastUserInteractionAt).toBe(captured)
 expect(JSON.parse(native.save.mock.calls[0][1])).toEqual(saved)
 await vi.advanceTimersByTimeAsync(2500)
 expect(native.save).toHaveBeenCalledOnce();expect(native.reminder).not.toHaveBeenCalled()
})

describe('bounded clock-only native mirror during a gesture',()=>{
 beforeEach(async()=>{
  native.save.mockResolvedValue(true)
  const now=Date.now()
  useStore.setState({S:{...structuredClone(DEF),
   bodyweight:[{d:'2026-10-01',w:80}],workouts:[{id:'keep-history',entries:[]}],
   active:{id:'mirror-gesture',start:now-minute,lastUserInteractionAt:now,sessionOrigin:{type:'extra',routineId:null},entries:[{id:'exercise',sets:[{done:false,r:8,w:20}]}]}},user:null})
  await useStore.getState().flushPersistence();vi.clearAllMocks()
 })
 const clock=()=>useStore.getState().recordInteraction(Date.now())
 const gesture=()=>useStore.getState().recordInteraction(Date.now(),{defer:true,quietMs:1800})
 const disk=()=>JSON.parse(localStorage.getItem('gym_state_v1'))
 const lastNative=()=>native.save.mock.calls.at(-1)
 const finish=async()=>{window.dispatchEvent(new Event('pagehide'));await vi.advanceTimersByTimeAsync(5000)}

 it('moves an earlier clock-only mirror out of the gesture but submits it by the first two-second bound',async()=>{
  const start=Date.now(),rows=structuredClone(useStore.getState().S.active.entries)
  clock();const firstPrimary=localStorage.getItem('gym_state_v1')
  await vi.advanceTimersByTimeAsync(650);gesture()
  expect(useStore.getState().reconcileActiveClock().lastUserInteractionAt).toBe(start+650)
  await vi.advanceTimersByTimeAsync(150);expect(native.save).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1199);expect(native.save).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1)
  expect(native.save).toHaveBeenCalledOnce();expect(lastNative()[1]).toBe(firstPrimary)
  expect(lastNative()[0].active.lastUserInteractionAt).toBe(start)
  await vi.advanceTimersByTimeAsync(500)
  expect(disk().active.lastUserInteractionAt).toBe(start+650)
  expect(native.save).toHaveBeenCalledOnce()
  await vi.advanceTimersByTimeAsync(800)
  expect(native.save).toHaveBeenCalledTimes(2)
  expect(lastNative()[0].active.lastUserInteractionAt).toBe(start+650)
  expect(lastNative()[1]).toBe(localStorage.getItem('gym_state_v1'))
  expect(lastNative()[0].active.entries).toEqual(rows)
  expect(lastNative()[0].bodyweight).toEqual([{d:'2026-10-01',w:80}])
  expect(lastNative()[0].workouts).toEqual([{id:'keep-history',entries:[]}])
  expect(native.reminder).not.toHaveBeenCalled()
 })

 it('retains the first native deadline while repeated ruler input journals its independent hard limit without RAF',async()=>{
  const start=Date.now();clock()
  const frame=vi.spyOn(window,'requestAnimationFrame').mockReturnValue(999)
  try{
   await vi.advanceTimersByTimeAsync(650);gesture()
   await vi.advanceTimersByTimeAsync(550);gesture()
   await vi.advanceTimersByTimeAsync(600);gesture()
   await vi.advanceTimersByTimeAsync(199);expect(native.save).not.toHaveBeenCalled()
   await vi.advanceTimersByTimeAsync(1);expect(native.save).toHaveBeenCalledOnce()
   await vi.advanceTimersByTimeAsync(650)
   expect(disk().active.lastUserInteractionAt).toBe(start)
   expect(JSON.parse(localStorage.getItem('gym_workout_clock_v1')).at).toBe(start+1800)
   expect(useStore.getState().S.active.lastUserInteractionAt).toBe(start+1800)
   expect(native.clock).toHaveBeenCalledOnce()
   expect(frame).not.toHaveBeenCalled()
   await vi.advanceTimersByTimeAsync(800)
   expect(native.save).toHaveBeenCalledOnce()
   await vi.advanceTimersByTimeAsync(2500);expect(native.save).toHaveBeenCalledOnce()
   await useStore.getState().flushPersistence()
   expect(lastNative()[0].active.lastUserInteractionAt).toBe(start+1800)
  }finally{frame.mockRestore()}
 })

 it('retains that first native bound when another clock-only primary commit arrives before it',async()=>{
  const start=Date.now();clock()
  await vi.advanceTimersByTimeAsync(650);gesture()
  await vi.advanceTimersByTimeAsync(650);clock()
  await vi.advanceTimersByTimeAsync(500);gesture()
  await vi.advanceTimersByTimeAsync(199);expect(native.save).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1)
  expect(native.save).toHaveBeenCalledOnce()
  expect(lastNative()[0].active.lastUserInteractionAt).toBe(start+1300)
  expect(lastNative()[1]).toBe(localStorage.getItem('gym_state_v1'))
  await finish()
 })

 it('does not extend the native two-second bound when the wall clock moves backwards',async()=>{
  clock()
  await vi.advanceTimersByTimeAsync(650)
  vi.setSystemTime(Date.now()-60*minute);gesture()
  await vi.advanceTimersByTimeAsync(1349);expect(native.save).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1);expect(native.save).toHaveBeenCalledOnce()
  await finish()
 })

 it('keeps the original 800ms native timer for a normal interaction without an extended quiet request',async()=>{
  clock();await vi.advanceTimersByTimeAsync(650)
  useStore.getState().recordInteraction(Date.now(),{defer:true})
  await vi.advanceTimersByTimeAsync(149);expect(native.save).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1);expect(native.save).toHaveBeenCalledOnce()
  await finish()
 })

 it.each(['bodyweight','reminder'])('never postpones an ordinary pending %s snapshot for a ruler gesture',async kind=>{
  useStore.getState().update(s=>{if(kind==='bodyweight')s.bodyweight.push({d:'2026-10-02',w:81});else s.reminder.time='11:45'})
  const ordinary=structuredClone(useStore.getState().S)
  await vi.advanceTimersByTimeAsync(650);gesture()
  await vi.advanceTimersByTimeAsync(149);expect(native.save).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1);expect(native.save).toHaveBeenCalledOnce()
  expect(lastNative()[0].bodyweight).toEqual(ordinary.bodyweight)
  expect(lastNative()[0].reminder).toEqual(ordinary.reminder)
  expect(native.reminder).toHaveBeenCalledOnce()
  await finish()
 })

 it('returns an extended clock-only timer to ordinary 800ms priority when a data edit arrives',async()=>{
  clock();await vi.advanceTimersByTimeAsync(650);gesture()
  await vi.advanceTimersByTimeAsync(250)
  useStore.getState().update(s=>{s.reminder.time='12:15'})
  await vi.advanceTimersByTimeAsync(300);gesture()
  await vi.advanceTimersByTimeAsync(499);expect(native.save).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1)
  expect(native.save).toHaveBeenCalledOnce();expect(lastNative()[0].reminder.time).toBe('12:15')
  expect(native.reminder).toHaveBeenCalledOnce()
  await finish()
 })

 it('does not move a pending mirror when the old published inactivity cutoff is near',async()=>{
  const start=Date.now(),captured=start+2300-30*minute
  useStore.setState({S:{...useStore.getState().S,active:{...useStore.getState().S.active,start:start-31*minute,lastUserInteractionAt:captured}}})
  useStore.getState().recordInteraction(captured)
  await vi.advanceTimersByTimeAsync(650);gesture()
  await vi.advanceTimersByTimeAsync(149);expect(native.save).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1);expect(native.save).toHaveBeenCalledOnce()
  expect(lastNative()[0].active.lastUserInteractionAt).toBe(captured)
  await vi.advanceTimersByTimeAsync(1251)
  expect(disk().active.lastUserInteractionAt).toBe(captured)
  expect(JSON.parse(localStorage.getItem('gym_workout_clock_v1')).at).toBe(start+650)
  expect(useStore.getState().S.active.lastUserInteractionAt).toBe(start+650)
  expect(disk().active.timerPausedAt).toBeUndefined()
  await finish()
 })

 it.each(['pagehide','explicit flush'])('immediately submits the latest captured input on %s and clears both old scheduling paths',async action=>{
  const start=Date.now();clock()
  await vi.advanceTimersByTimeAsync(650);gesture()
  await vi.advanceTimersByTimeAsync(350)
  if(action==='pagehide')window.dispatchEvent(new Event('pagehide'))
  else await useStore.getState().flushPersistence()
  expect(native.save).toHaveBeenCalledOnce()
  expect(lastNative()[0].active.lastUserInteractionAt).toBe(start+650)
  expect(lastNative()[1]).toBe(localStorage.getItem('gym_state_v1'))
  await vi.advanceTimersByTimeAsync(5000);expect(native.save).toHaveBeenCalledOnce()
 })

 it('submits Pause and Continue immediately without retaining a delayed older clock-only snapshot',async()=>{
  clock();const rows=structuredClone(useStore.getState().S.active.entries)
  await vi.advanceTimersByTimeAsync(650);gesture()
  await vi.advanceTimersByTimeAsync(250)
  useStore.getState().update(s=>{s.active={...s.active,timerPausedAt:Date.now(),pauseReason:'manual'}})
  expect(native.save).toHaveBeenCalledOnce();expect(lastNative()[0].active.pauseReason).toBe('manual')
  await vi.advanceTimersByTimeAsync(100)
  useStore.getState().update(s=>{s.active=resumeWorkoutClock(s.active)})
  expect(native.save).toHaveBeenCalledTimes(2);expect(lastNative()[0].active.timerPausedAt).toBeUndefined()
  expect(lastNative()[0].active.entries).toEqual(rows)
  expect(lastNative()[0].workouts).toEqual([{id:'keep-history',entries:[]}])
  await vi.advanceTimersByTimeAsync(5000);expect(native.save).toHaveBeenCalledTimes(2)
 })
})
