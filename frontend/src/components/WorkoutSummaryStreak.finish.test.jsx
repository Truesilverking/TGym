// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { bindUI } from './ui.jsx'
import { doFinishWorkout, finishWorkout } from '../sheets.jsx'
import { playAppSound } from '../lib/sound.js'
import { trainingStreak } from '../lib/training-plan.js'

vi.mock('../lib/sound.js', () => ({ playAppSound: vi.fn(), vibrate: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: vi.fn(async () => ({})), setRemoteAuth: vi.fn() }))
vi.mock('../lib/web-state.js', () => ({ loadWebState: async () => null, saveWebState: async () => true }))
vi.mock('../lib/i18n.js', async original => ({ ...await original(), t: (key, ...values) => key.replace(/\{(\d+)\}/g, (_, index) => values[index]) }))

const today = '2026-10-08'
const workout = (id, d = today, done = true) => ({
  id, d, name: 'Synthetic extra', routineId: null, sessionOrigin: { type: 'extra', routineId: null },
  start: new Date(d + 'T10:00:00').getTime(), end: new Date(d + 'T10:01:00').getTime(),
  entries: [{ id: '0025', target: { mode: 'reps', sets: 1, reps: 8, weight: 40 }, sets: [{ done, r: 8, w: 40 }] }],
})
const active = (id = 'new-session', done = true) => ({ ...workout(id, today, done), start: Date.now() - 60000, end: undefined, unit: 'kg' })
function Sheets() { return useUI(state => state.sheets).map(sheet => <div key={sheet.id}>{sheet.render(() => useUI.getState().closeSheet(sheet.id))}</div>) }
let host, root
const state = () => useStore.getState().S
const number = () => host.querySelector('.workout-summary-streak-value')?.textContent
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers(); vi.setSystemTime(new Date(today + 'T12:00:00'))
  localStorage.clear(); sessionStorage.clear(); vi.clearAllMocks()
  useStore.setState({ S: { ...structuredClone(DEF), lang: 'en', trainingStartDate: '2026-10-05', hasCompletedOnboarding: true, hasCompletedAppTour: true }, user: null, storageWarning: null })
  useUI.setState({ sheets: [], timer: null, work: null }); bindUI(useUI)
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  act(() => root.render(<MemoryRouter><Sheets /></MemoryRouter>))
})
afterEach(() => {
  act(() => root.unmount()); host.remove()
  useUI.getState().stopRest(); useUI.getState().stopWork(); useUI.getState().closeAll()
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks()
})

it('shows the first active-day streak only after successful save, without requiring a milestone', () => {
  act(() => useStore.setState({ S: { ...state(), active: active() } }))
  expect(trainingStreak(state()).current).toBe(0); expect(number()).toBeUndefined()
  act(() => doFinishWorkout())
  expect(state().active).toBeNull(); expect(state().workouts).toHaveLength(1)
  expect(JSON.parse(localStorage.getItem('gym_state_v1')).workouts).toHaveLength(1)
  expect(number()).toBe('1'); expect(host.querySelector('.streak-flame-fill').getAttribute('y')).toBe('0')
  expect(host.querySelector('.streak-celebration')).toBeNull()
})
it('uses the persisted post-save total for an ordinary four-day streak', () => {
  const previous = ['2026-10-05', '2026-10-06', '2026-10-07'].map((date, index) => workout('saved-' + index, date))
  act(() => useStore.setState({ S: { ...state(), workouts: previous, active: active() } }))
  expect(trainingStreak(state()).current).toBe(3)
  act(() => doFinishWorkout())
  expect(number()).toBe('4'); expect(host.querySelector('.workout-summary-streak.active')).not.toBeNull()
  expect(state().workouts.slice(0, 3)).toEqual(previous)
})
it('keeps a saved session without confirmed activity at zero and neutral', () => {
  act(() => useStore.setState({ S: { ...state(), active: active('empty', false) } }))
  act(() => doFinishWorkout())
  expect(state().workouts).toHaveLength(1); expect(trainingStreak(state()).current).toBe(0)
  expect(number()).toBe('0'); expect(host.querySelector('.streak-flame.inactive')).not.toBeNull()
})
it('does not show or count a cancelled finish confirmation or a session that never started', () => {
  act(() => doFinishWorkout()); expect(useUI.getState().sheets).toHaveLength(0)
  act(() => useStore.setState({ S: { ...state(), active: active('pending', false) } }))
  act(() => finishWorkout()); expect(host.textContent).toContain('Nothing logged yet')
  const cancel = [...host.querySelectorAll('button')].find(button => button.textContent === 'Cancel')
  act(() => cancel.click())
  expect(number()).toBeUndefined(); expect(state().workouts).toHaveLength(0)
  expect(state().active.id).toBe('pending'); expect(trainingStreak(state()).current).toBe(0)
  expect(playAppSound).not.toHaveBeenCalled()
})
it('counts a second legitimate workout on the same date only once', () => {
  act(() => useStore.setState({ S: { ...state(), active: active('first') } })); act(() => doFinishWorkout())
  act(() => useUI.getState().closeAll())
  act(() => useStore.setState({ S: { ...state(), active: active('second') } })); act(() => doFinishWorkout())
  expect(state().workouts).toHaveLength(2); expect(number()).toBe('1')
})
it('does not open a phantom summary or replay completion for a repeated or duplicate-ID save', () => {
  act(() => useStore.setState({ S: { ...state(), active: active('same-id') } })); act(() => doFinishWorkout())
  const saved = structuredClone(state().workouts)
  act(() => useUI.getState().closeAll()); act(() => doFinishWorkout())
  expect(useUI.getState().sheets).toHaveLength(0)
  act(() => useStore.setState({ S: { ...state(), active: active('same-id') } })); act(() => doFinishWorkout())
  expect(useUI.getState().sheets).toHaveLength(0); expect(state().workouts).toEqual(saved)
  expect(playAppSound.mock.calls.filter(([, event]) => event === 'completion')).toHaveLength(1)
})
