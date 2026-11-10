// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Workout from './Workout.jsx'
import { finishWorkout } from '../sheets.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { bindUI } from '../components/ui.jsx'

vi.mock('../lib/sound.js', () => ({ playAppSound: vi.fn(), vibrate: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: vi.fn(async () => ({})), setRemoteAuth: vi.fn() }))
vi.mock('../components/Media.jsx', () => ({ default: () => null }))
vi.mock('../lib/spotifree-sync.js', () => ({ launchSpotifree: vi.fn(), emitWorkoutFinish: vi.fn(), emitRestStart: vi.fn(), emitRestEnd: vi.fn() }))
globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, host
const current = () => useStore.getState().S
const session = (id, extra = {}) => ({ id, d: '2026-10-27', start: Date.now() - 60000, name: 'Lifecycle regression', cur: 0, entries: [{ id: '0025', target: { mode: 'time', bodyweight: true, sec: 45 }, sets: [{ sec: 45, w: 0, done: false }] }], ...extra })
function Sheets() { return useUI(s => s.sheets).map(sheet => <div key={sheet.id}>{sheet.render(() => useUI.getState().closeSheet(sheet.id))}</div>) }
const click = text => { const button = [...host.querySelectorAll('button')].find(node => node.textContent === text); expect(button).toBeTruthy(); act(() => button.click()) }
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-27T12:00:00-04:00'))
  localStorage.clear(); useUI.getState().stopRest(); useUI.getState().stopWork(); useUI.getState().closeAll(); bindUI(useUI)
  useStore.setState({ S: { ...structuredClone(DEF), lang: 'en', active: session('original') }, user: null })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  act(() => root.render(<MemoryRouter><Workout /><Sheets /></MemoryRouter>))
})
afterEach(() => {
  act(() => { useUI.getState().stopWork(); useUI.getState().stopRest(); useUI.getState().closeAll(); root.unmount() })
  host.remove(); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks()
})

it('discard cancels a timed hold before clearing its workout', () => {
  act(() => host.querySelector('[aria-label="Start set"]').click())
  expect(useUI.getState().work).not.toBeNull()
  act(() => host.querySelector('[aria-label="Discard"]').click())
  click('Discard')
  expect(current().active).toBeNull()
  expect(useUI.getState().work).toBeNull()
  act(() => vi.advanceTimersByTime(60000))
  expect(current().workouts).toHaveLength(0)
})

it('an old finish confirmation cannot finish a replacement session', () => {
  act(() => finishWorkout())
  const replacement = session('replacement')
  act(() => useStore.setState({ S: { ...current(), active: replacement } }))
  const before = structuredClone(current().active)
  click('Finish anyway')
  expect(current().active).toEqual(before)
  expect(current().workouts).toHaveLength(0)
})

it('canceling an old finish confirmation cannot resume a replacement session', () => {
  act(() => finishWorkout())
  const replacement = session('replacement', { timerPausedAt: Date.now() - 1000, pauseReason: 'manual' })
  act(() => useStore.setState({ S: { ...current(), active: replacement } }))
  const before = structuredClone(current().active)
  click('Cancel')
  expect(current().active).toEqual(before)
})
