// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useStore, DEF } from './useStore.js'
import { workoutElapsedMs, resumeWorkoutClock } from '../lib/workout-time.js'

const native = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn(), reminder: vi.fn() }))
vi.mock('../lib/mobile.js', () => ({
  MOBILE: true, nativeLoad: native.load, nativeSave: native.save,
  syncReminder: native.reminder, writeAutoBackup: vi.fn(),
}))
vi.mock('../lib/remote.js', () => ({ loadRemote: async () => null, chooseLocal: vi.fn(), forgetRemote: vi.fn(), connect: vi.fn() }))

const minute = 60000
const completed = () => ({ id: 'restored', start: 360 * minute, entries: [{ id: 'ex', sets: [{ done: true, doneAt: 432 * minute }] }] })
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(540 * minute)
  vi.clearAllMocks()
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
