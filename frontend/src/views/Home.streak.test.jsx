// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Home from './Home.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { bindUI } from '../components/ui.jsx'
import { doFinishWorkout } from '../sheets.jsx'

vi.mock('../lib/sound.js', () => ({ playAppSound: vi.fn(), vibrate: vi.fn() }))
vi.mock('../lib/api.js', async original => ({ ...await original(), api: vi.fn(async path => path === '/api/me' ? { user: null } : {}), setRemoteAuth: vi.fn() }))
vi.mock('../lib/web-state.js', () => ({ loadWebState: async () => null, saveWebState: async () => true }))
vi.mock('../lib/i18n.js', async original => ({ ...await original(), t: (key, ...values) => key.replace(/\{(\d+)\}/g, (_, index) => values[index]) }))

// Synthetic dates: the screenshot supplies counters, not the user's history.
// Two planned + three extra sessions occupy four dates; one date is shared.
const workout = (id, d, planned = false) => ({
  id, d, name: 'Synthetic routine', routineId: planned ? 'routine' : null,
  sessionOrigin: { type: planned ? 'planned' : 'extra', routineId: planned ? 'routine' : null },
  start: new Date(d + 'T10:00:00').getTime(), end: new Date(d + 'T10:01:00').getTime(),
  entries: [{ id: '0025', target: { mode: 'reps' }, sets: [{ done: true, r: 8, w: 20 }] }],
})
const fixture = () => ({
  ...structuredClone(DEF), lang: 'en', hasCompletedOnboarding: true, hasCompletedAppTour: true,
  trainingStartDate: '2026-09-28', scheduleStarted: '2026-09-28',
  trainingHistory: { trackedFrom: '2026-09-28', historicalWorkouts: 0, workoutsPerWeek: 2 },
  routines: [{ id: 'routine', name: 'Synthetic routine', ex: [] }], week: { 1: ['routine'], 2: ['routine'] },
  trainingPauses: [{ id: 'pause', start: '2026-10-02', end: null }],
  workouts: [workout('planned-1', '2026-09-28', true), workout('planned-2', '2026-09-29', true),
    workout('extra-same-day', '2026-09-29'), workout('extra-1', '2026-09-30'), workout('extra-2', '2026-10-01')],
})
let host, root
const flame = () => host.querySelector('.header-streak b').textContent
const metric = label => [...host.querySelectorAll('.consistency-card dt')].find(node => node.textContent === label)?.nextElementSibling.textContent
const mount = Component => act(() => root.render(<MemoryRouter><Component /></MemoryRouter>))

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-03T13:01:00'))
  localStorage.clear(); sessionStorage.clear(); vi.clearAllMocks()
  useStore.setState({ S: fixture(), user: null, storageWarning: null, serverSyncError: null })
  useUI.setState({ timer: null, work: null, sheets: [] }); bindUI(useUI)
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount()); host.remove()
  useUI.getState().stopRest(); useUI.getState().stopWork()
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks()
})

it('shows four activity days for two planned and three extra sessions while paused, without rewriting history', () => {
  const history = structuredClone(useStore.getState().S.workouts)
  mount(Home)
  expect(flame()).toBe('4')
  expect(metric('Planned')).toBe('2'); expect(metric('Extra')).toBe('3')
  expect(metric('Active days')).toBe('4'); expect(metric('Completion')).toBe('100%')
  expect(host.querySelector('.today-row').textContent).toContain('Training paused')
  expect(useStore.getState().S.workouts).toEqual(history)
  expect(localStorage.getItem('gym_state_v1')).toBeNull()
})

it('recalculates on actual completion and repeated finish counts that date only once', async () => {
  vi.setSystemTime(new Date('2026-10-01T10:01:00'))
  const state = fixture(); state.workouts.pop()
  state.active = { ...workout('extra-2', '2026-10-01'), end: undefined }
  useStore.setState({ S: state }); mount(Home)
  expect(flame()).toBe('3')
  await act(async () => { doFinishWorkout({ silent: true }); doFinishWorkout({ silent: true }); await useStore.getState().flushPersistence() })
  expect(flame()).toBe('4'); expect(metric('Extra')).toBe('3')
  expect(useStore.getState().S.workouts).toHaveLength(5)
  expect(JSON.parse(localStorage.getItem('gym_state_v1')).workouts).toHaveLength(5)
})

it('recalculates valid edits, zero-activity edits and deletions without inflating shared dates', () => {
  mount(Home)
  act(() => useStore.getState().update(s => { s.workouts[3].entries[0].sets[0].r = 12 }))
  expect(flame()).toBe('4')
  act(() => useStore.getState().update(s => { s.workouts[3].entries[0].sets[0].r = 0 }))
  expect(flame()).toBe('3')
  act(() => useStore.getState().update(s => { s.workouts[3].entries[0].sets[0].r = 8 }))
  expect(flame()).toBe('4')
  act(() => useStore.getState().update(s => { s.workouts = s.workouts.filter(w => w.id !== 'extra-same-day') }))
  expect(flame()).toBe('4'); expect(metric('Extra')).toBe('2')
  act(() => useStore.getState().update(s => { s.workouts = s.workouts.filter(w => w.id !== 'extra-2') }))
  expect(flame()).toBe('3'); expect(metric('Extra')).toBe('1')
})

it('loads the same four-day flame after a fresh store and Home boot from the saved profile', async () => {
  act(() => useStore.getState().replaceState(fixture()))
  const saved = JSON.parse(localStorage.getItem('gym_state_v1'))
  mount(Home); expect(flame()).toBe('4')
  act(() => { root.unmount(); root = createRoot(host) })
  vi.resetModules()
  const { useStore: reopened } = await import('../store/useStore.js')
  await reopened.getState().boot()
  const { default: ReopenedHome } = await import('./Home.jsx')
  mount(ReopenedHome)
  expect(flame()).toBe('4')
  expect(reopened.getState().S.workouts).toEqual(saved.workouts)
  expect(metric('Planned')).toBe('2'); expect(metric('Extra')).toBe('3')
})
