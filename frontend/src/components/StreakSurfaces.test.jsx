// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Home from '../views/Home.jsx'
import Stats from '../views/Stats.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { bindUI } from './ui.jsx'
import { doFinishWorkout, streakDetailSheet } from '../sheets.jsx'

vi.mock('../lib/sound.js', () => ({ playAppSound: vi.fn(), vibrate: vi.fn() }))
vi.mock('../lib/api.js', async original => ({ ...await original(), api: vi.fn(async () => ({})), setRemoteAuth: vi.fn() }))
vi.mock('../lib/web-state.js', () => ({ loadWebState: async () => null, saveWebState: async () => true }))
vi.mock('../lib/i18n.js', async original => ({ ...await original(), t: (key, ...values) => key.replace(/\{(\d+)\}/g, (_, index) => values[index]) }))

const workout = (id, d) => ({
  id, d, name: 'Synthetic training', routineId: 'routine', sessionOrigin: { type: 'planned', routineId: 'routine' },
  start: new Date(d + 'T10:00:00').getTime(), end: new Date(d + 'T10:01:00').getTime(),
  entries: [{ id: '0025', target: { mode: 'reps', sets: 1, reps: 8, weight: 20 }, sets: [{ done: true, r: 8, w: 20 }] }],
})
const fixture = () => ({
  ...structuredClone(DEF), lang: 'en', sound: false, vibration: false,
  hasCompletedOnboarding: true, hasCompletedAppTour: true,
  trainingStartDate: '2026-09-28', scheduleStarted: '2026-09-28',
  trainingHistory: { trackedFrom: '2026-09-28', historicalWorkouts: 0, workoutsPerWeek: 2 },
  routines: [{ id: 'routine', name: 'Synthetic training', ex: [] }], week: { 1: ['routine'], 5: ['routine'] },
  workouts: [workout('monday', '2026-09-28')], statsSections: ['history'],
})
function Sheets() { return useUI(s => s.sheets).map(sheet => <div key={sheet.id}>{sheet.render(() => useUI.getState().closeSheet(sheet.id))}</div>) }
let host, root
const surfaces = () => [host.querySelector('.header-streak'), host.querySelector('.streak-main'), host.querySelector('.stats-streak')]
function expectSurfaces(current, state) {
  const nodes = surfaces()
  expect(nodes.every(Boolean)).toBe(true)
  for (const node of nodes) {
    expect(node.dataset.streakState).toBe(state)
    expect(node.querySelector('.streak-flame-fill').getAttribute('opacity')).toBe(current > 0 ? '1' : '0')
  }
  expect(nodes[0].querySelector('b').textContent).toBe(String(current))
  expect(nodes[1].querySelector('.streak-number').textContent).toBe(String(current))
  expect(nodes[2].querySelector('.v').textContent).toBe(String(current))
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-02T12:00:00'))
  localStorage.clear(); sessionStorage.clear(); vi.clearAllMocks()
  useStore.setState({ S: fixture(), user: null, storageWarning: null, serverSyncError: null })
  useUI.setState({ sheets: [], timer: null, work: null }); bindUI(useUI)
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount()); host.remove()
  useUI.getState().stopRest(); useUI.getState().stopWork(); useUI.getState().closeAll()
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks()
})
function mount() {
  act(() => root.render(<MemoryRouter><Home /><Stats /><Sheets /></MemoryRouter>))
  act(() => streakDetailSheet())
}

it.each([
  ['pending', '2026-10-02T23:59:59', {}, 1],
  ['rest', '2026-10-01T12:00:00', {}, 1],
  ['paused', '2026-10-02T12:00:00', { trainingPauses: [{ id: 'pause', start: '2026-10-02', end: null }] }, 1],
  ['interrupted', '2026-10-03T12:00:00', {}, 0],
  ['inactive', '2026-10-02T12:00:00', { workouts: [] }, 0],
])('uses the same count and %s state in header, detail and Stats', (state, instant, patch, current) => {
  vi.setSystemTime(new Date(instant)); useStore.setState({ S: { ...fixture(), ...patch } })
  const history = structuredClone(useStore.getState().S.workouts)
  mount(); expectSurfaces(current, state)
  expect(useStore.getState().S.workouts).toEqual(history)
  expect(localStorage.getItem('gym_state_v1')).toBeNull()
})

it('keeps all three mounted surfaces synchronized across the local deadline without writing data', () => {
  vi.setSystemTime(new Date('2026-10-02T23:59:59')); mount(); expectSurfaces(1, 'pending')
  const history = structuredClone(useStore.getState().S.workouts)
  act(() => vi.advanceTimersByTime(1002)); expectSurfaces(0, 'interrupted')
  expect(useStore.getState().S.workouts).toEqual(history)
  expect(localStorage.getItem('gym_state_v1')).toBeNull()
})

it('updates all surfaces and the saved Finish summary once, then reconciles history edits', () => {
  mount(); expectSurfaces(1, 'pending')
  const w = workout('friday', '2026-10-02')
  act(() => useStore.getState().update(s => { s.active = { ...w, end: undefined } }))
  expectSurfaces(1, 'pending')
  act(() => doFinishWorkout())
  expectSurfaces(2, 'active')
  expect(host.querySelector('.workout-summary-streak-value').textContent).toBe('2')
  expect(host.querySelector('.workout-summary-streak').dataset.streakState).toBe('active')
  act(() => doFinishWorkout()); expectSurfaces(2, 'active')
  act(() => useStore.getState().update(s => { s.workouts = s.workouts.filter(row => row.id !== 'friday') }))
  expectSurfaces(1, 'pending')
  expect(host.querySelector('.workout-summary-streak-value').textContent).toBe('1')
  expect(host.querySelector('.workout-summary-streak').dataset.streakState).toBe('pending')
})
