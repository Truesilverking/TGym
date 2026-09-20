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
