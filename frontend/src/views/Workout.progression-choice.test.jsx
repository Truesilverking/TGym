// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Workout from './Workout.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { bindUI } from '../components/ui.jsx'
import { beginWorkout } from '../sheets.jsx'
import { setLang } from '../lib/i18n.js'

vi.mock('../lib/sound.js', () => ({ playAppSound: vi.fn(), vibrate: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: vi.fn(async () => ({})) }))
vi.mock('../components/Media.jsx', () => ({ default: () => null }))
globalThis.IS_REACT_ACT_ENVIRONMENT = true
let host, root
const state = () => useStore.getState().S
const render = () => root.render(<MemoryRouter><Workout /></MemoryRouter>)
const reopen = () => act(() => {
  const saved = JSON.parse(localStorage.getItem('gym_state_v1'))
  root.unmount(); root = createRoot(host)
  useStore.getState().replaceState(saved)
  render()
})
beforeEach(async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-17T14:00:00Z'))
  localStorage.clear(); await setLang('en')
  bindUI(useUI)
  useUI.setState({ sheets: [], timer: null, work: null, appTourRequest: null, appTourWorkoutPreview: false })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount()); host.remove()
  useUI.getState().closeAll(); useUI.getState().stopRest(); useUI.getState().stopWork()
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks()
})
function start() {
  const target = { id: '0025', mode: 'reps', bodyweight: false, setScheme: 'topback', sets: 3,
    topSets: 1, backoffSets: 2, weight: 100, reps: 6, topRepsMin: 4, topRepsMax: 6,
    backoffPct: 10, prog: 'linear', inc: 5, loadingStep: 2.5 }
  useStore.setState({ user: null, S: { ...structuredClone(DEF), lang: 'en', unit: 'kg',
    hasCompletedOnboarding: true, hasCompletedAppTour: true,
    routines: [{ id: 'kept-routine', name: 'Lower A / Cuádriceps-Isquiotibiales', ex: [target] }],
    routineOrder: ['kept-routine'], workouts: [{ id: 'kept-history', d: '2026-11-12', start: 1, end: 60001,
      entries: [{ id: target.id, target, sets: [{ w: 100, r: 6, role: 'top', done: true },
        { w: 90, r: 8, role: 'backoff', done: true }, { w: 90, r: 8, role: 'backoff', done: true }] }] }] } })
  act(() => { beginWorkout('kept-routine', 80); render() })
}

it.each([['accept', 'accepted', [105, 95, 95]], ['decline', 'declined', [100, 90, 90]]])(
  'asks before increasing and persists the %s decision with dependent loads', (choice, status, weights) => {
    start()
    const history = structuredClone(state().workouts), routines = structuredClone(state().routines)
    expect(state().active.entries[0].sets.map(row => row.w)).toEqual([100, 90, 90])
    expect(host.querySelector('.load-progression-choice').textContent).toContain('Ready to increase the weight?')
    reopen()
    expect(state().active.entries[0].loadProgression.status).toBe('pending')
    act(() => host.querySelector(`[data-load-choice="${choice}"]`).click())
    expect(state().active.entries[0].loadProgression.status).toBe(status)
    expect(state().active.entries[0].sets.map(row => row.w)).toEqual(weights)
    expect(host.querySelector('.load-progression-choice')).toBeNull()
    reopen()
    expect(state().active.entries[0].loadProgression.status).toBe(status)
    expect(state().active.entries[0].sets.map(row => row.w)).toEqual(weights)
    expect(state().workouts).toEqual(history); expect(state().routines).toEqual(routines)
  })

it('keeps completed work intact when accepting after the Top set was recorded', () => {
  start()
  act(() => useStore.getState().update(S => {
    const top = S.active.entries[0].sets[0]
    top.done = true; top.doneAt = Date.now(); top.r = 5
  }))
  const completed = structuredClone(state().active.entries[0].sets[0])
  act(() => host.querySelector('[data-load-choice="accept"]').click())
  expect(state().active.entries[0].sets[0]).toEqual(completed)
  expect(state().active.entries[0].sets.slice(1).map(row => row.w)).toEqual([90, 90])
})

it('shows the explicit choice in Spanish', async () => {
  await setLang('es')
  start()
  expect(host.querySelector('[data-load-choice="accept"]').textContent).toContain('Sí, aumentar')
  expect(host.querySelector('[data-load-choice="decline"]').textContent).toContain('Mantener el peso actual')
})
