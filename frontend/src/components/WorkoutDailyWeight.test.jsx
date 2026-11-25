// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { startFlow } from '../sheets.jsx'
import { setLang, t } from '../lib/i18n.js'
import { pauseWorkoutClock } from '../lib/workout-time.js'
import { LB_PER_KG } from '../lib/weight-units.js'

let root, host, flush, atomic
const state = () => useStore.getState().S
const snapshot = () => ({ bodyweight: structuredClone(state().bodyweight), routines: structuredClone(state().routines), workouts: structuredClone(state().workouts) })
const todayRow = extra => ({ d: '2026-11-21', w: 80.5, t: Date.now() - 1000,
  samples: [{ id: 'kept-weight', source: 'health-connect', w: 80.5, unit: 'kg', t: Date.now() - 1000 }], ...extra })
function Sheets() { return useUI(s => s.sheets).map(sheet => <div key={sheet.id}>{sheet.render(() => useUI.getState().closeSheet(sheet.id))}</div>) }
const start = id => act(() => startFlow(id))
const button = key => [...host.querySelectorAll('button')].find(node => node.textContent === t(key))
const enter = text => act(() => {
  const input = host.querySelector(`input[aria-label="${t('Weight')}"]`)
  expect(input).not.toBeNull(); input.focus()
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, text)
  input.dispatchEvent(new Event('input', { bubbles: true })); input.blur()
})

beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-21T12:00:00'))
  await setLang('en'); localStorage.clear()
  flush = useStore.getState().flushPersistence; atomic = useStore.getState().updateAtomic
  useStore.setState({ user: null, S: { ...structuredClone(DEF), lang: 'en',
    hasCompletedOnboarding: true, hasCompletedAppTour: true,
    bodyweight: [{ d: '2026-11-20', w: 79 }],
    routines: ['routine-a', 'routine-b'].map(id => ({ id, name: id, ex: [{ id: '0025', sets: 1, reps: 8, weight: 30, prog: 'off' }] })),
    routineOrder: ['routine-a', 'routine-b'],
    workouts: [{ id: 'kept-history', d: '2026-11-20', entries: [{ id: '0025', sets: [{ w: 30, r: 8, done: true }] }] }],
  }, flushPersistence: vi.fn().mockResolvedValue() })
  useUI.setState({ sheets: [], toastMsg: '', timer: null, work: null })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(() => root.render(<Sheets />))
})
afterEach(async () => {
  await act(() => root.unmount()); host.remove(); useUI.getState().closeAll()
  useStore.setState({ flushPersistence: flush, updateAtomic: atomic })
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks()
})

it.each(['manual', 'withings', 'health-connect'])('starts from today\'s %s weight without another check-in or sample', async source => {
  useStore.setState({ S: { ...state(), bodyweight: [...state().bodyweight, todayRow({ samples: [{ id: 'kept-weight', source, w: 80.5 }] })] } })
  const before = snapshot()
  start('routine-a')
  expect(state().active).toMatchObject({ routineId: 'routine-a', bw: 80.5, bwUnit: 'kg' })
  expect(useUI.getState().sheets).toHaveLength(0)
  expect(snapshot()).toEqual(before)
  expect(useStore.getState().flushPersistence).not.toHaveBeenCalled()
})

it('reuses the same daily aggregate for a second routine and after a serialized reopen', async () => {
  useStore.setState({ S: { ...state(), bodyweight: [...state().bodyweight, todayRow()] } })
  const before = snapshot()
  start('routine-a'); const firstId = state().active.id
  await act(() => useStore.getState().update(S => { S.active = null }))
  const saved = JSON.parse(localStorage.getItem('gym_state_v1'))
  await act(() => useStore.getState().replaceState(saved))
  start('routine-b')
  expect(state().active).toMatchObject({ routineId: 'routine-b', bw: 80.5 })
  expect(state().active.id).not.toBe(firstId)
  expect(snapshot()).toEqual(before); expect(useUI.getState().sheets).toHaveLength(0)
})

it.each([['kg', 'lb', 80, 80 * LB_PER_KG], ['lb', 'kg', 176, 176 / LB_PER_KG]])(
  'uses a %s stamped reading as a %s workout snapshot without converting stored data', (from, unit, w, expected) => {
    useStore.setState({ S: { ...state(), unit, bodyweight: [...state().bodyweight, todayRow({ unit: from, w })] } })
    const before = snapshot(); start('routine-a')
    expect(state().active.bw).toBeCloseTo(expected, 10); expect(state().active.bwUnit).toBe(unit)
    expect(snapshot()).toEqual(before)
  })

it('starts only one workout when Start is tapped twice with today\'s weight available', () => {
  useStore.setState({ S: { ...state(), bodyweight: [todayRow()] } })
  const before = snapshot()
  start('routine-a'); const active = structuredClone(state().active)
  start('routine-b')
  expect(state().active).toEqual(active); expect(snapshot()).toEqual(before)
  expect(useUI.getState().sheets).toHaveLength(0)
})

it('resumes the existing paused workout without replacing its weight or starting another one', async () => {
  useStore.setState({ S: { ...state(), bodyweight: [todayRow()] } })
  start('routine-a')
  await act(() => useStore.getState().update(S => { S.active = pauseWorkoutClock(S.active) }))
  const before = structuredClone(state().active)
  await act(() => useStore.getState().update(S => { S.bodyweight[0].w = 85 }))
  start('routine-b')
  expect(state().active).toEqual(before); expect(state().active.bw).toBe(80.5)
  expect(useUI.getState().sheets).toHaveLength(0)
})

it('retains the training-pause guard even when today\'s weight is already available', () => {
  useStore.setState({ S: { ...state(), bodyweight: [todayRow()], trainingPauses: [{ id: 'kept-pause', start: '2026-11-20', end: null }] } })
  const before = snapshot(); start('routine-a')
  expect(state().active).toBeNull(); expect(snapshot()).toEqual(before)
  expect(useUI.getState().sheets).toHaveLength(1)
  expect(host.querySelector('.bodyweight-picker')).toBeNull()
})

it('selects the next scheduled routine before reusing today\'s weight', () => {
  useStore.setState({ S: { ...state(), bodyweight: [todayRow()], dayPlan: { '2026-11-21': ['routine-b', 'routine-a'] } } })
  const before = snapshot(); start()
  expect(state().active).toMatchObject({ routineId: 'routine-b', bw: 80.5, dailyPlanIndex: 0, dailyPlanTotal: 2 })
  expect(snapshot()).toEqual(before); expect(useUI.getState().sheets).toHaveLength(0)
})

it('opens a single check-in again after midnight instead of silently using yesterday', async () => {
  useStore.setState({ S: { ...state(), bodyweight: [todayRow()] } })
  start('routine-a')
  await act(() => useStore.getState().update(S => { S.active = null }))
  vi.setSystemTime(new Date('2026-11-22T00:00:01'))
  start('routine-b'); start('routine-b')
  expect(state().active).toBeNull(); expect(useUI.getState().sheets).toHaveLength(1)
  expect(state().bodyweight).toHaveLength(1)
})

it.each([{}, { w: 0 }, { w: 'invalid' }, { t: Number.MAX_SAFE_INTEGER }, { unit: 'stones' }])(
  'retains the manual fallback for a missing or invalid reading (%j)', extra => {
    if (Object.keys(extra).length) useStore.setState({ S: { ...state(), bodyweight: [...state().bodyweight, todayRow(extra)] } })
    const before = snapshot(); start('routine-a')
    expect(state().active).toBeNull(); expect(useUI.getState().sheets).toHaveLength(1)
    expect(snapshot()).toEqual(before)
  })

it('keeps the profile unchanged after a failed start save and allows a clean retry', () => {
  useStore.setState({ S: { ...state(), bodyweight: [todayRow()] } })
  const before = snapshot(), original = localStorage.setItem.bind(localStorage)
  const write = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
    if (key === 'gym_state_v1') throw new DOMException('Full', 'QuotaExceededError')
    return original(key, value)
  })
  start('routine-a')
  expect(state().active).toBeNull(); expect(snapshot()).toEqual(before)
  expect(useUI.getState().toastMsg).toBe(t('Could not save. Check available storage and try again.'))
  write.mockRestore(); start('routine-a')
  expect(state().active).toMatchObject({ routineId: 'routine-a', bw: 80.5 })
  expect(snapshot()).toEqual(before)
})

it('starts only after a missing daily weight is saved successfully, and retry adds one sample', async () => {
  start('routine-a'); const before = snapshot()
  const failing = vi.fn().mockRejectedValueOnce(Error('save failed')).mockImplementation(mut => atomic(mut))
  useStore.setState({ updateAtomic: failing })
  enter('80.5'); await act(async () => button('Save & start workout').click())
  expect(state().active).toBeNull(); expect(snapshot()).toEqual(before)
  expect(useUI.getState().sheets).toHaveLength(1)
  await act(async () => button('Save & start workout').click())
  expect(state().active).toMatchObject({ routineId: 'routine-a', bw: 80.5 })
  const day = state().bodyweight.find(row => row.d === '2026-11-21')
  expect(day.samples).toHaveLength(1); expect(day.w).toBe(80.5)
  expect(state().workouts).toEqual(before.workouts); expect(state().routines).toEqual(before.routines)
})

it('uses the saved daily aggregate when an imported reading arrives while the check-in is open', async () => {
  start('routine-a')
  await act(() => useStore.getState().update(S => { S.bodyweight.push(todayRow({ w: 80, samples: [{ id: 'imported-weight', source: 'health-connect', w: 80 }] })) }))
  enter('82'); await act(async () => button('Save & start workout').click())
  const day = state().bodyweight.find(row => row.d === '2026-11-21')
  expect(day.w).toBe(81); expect(day.samples).toHaveLength(2)
  expect(state().active.bw).toBe(81)
  await act(() => useStore.getState().update(S => { S.active = null }))
  start('routine-b')
  expect(state().active.bw).toBe(81); expect(state().bodyweight.find(row => row.d === '2026-11-21')).toEqual(day)
})
