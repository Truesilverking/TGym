// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Workout from './Workout.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { bindUI } from '../components/ui.jsx'
import { beginWorkout, doFinishWorkout } from '../sheets.jsx'
import { setLang } from '../lib/i18n.js'

vi.mock('../lib/sound.js', () => ({ playAppSound:vi.fn(), vibrate:vi.fn() }))
vi.mock('../lib/api.js', () => ({ api:vi.fn(async () => ({})) }))
vi.mock('../components/Media.jsx', () => ({ default:() => null }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let host, root
const state = () => useStore.getState().S
const rows = () => state().active.entries[0].sets
const type = (name, index, text) => act(() => {
  const input = host.querySelectorAll(`input[aria-label="${name}"]`)[index]
  expect(input).toBeTruthy()
  input.focus()
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, text)
  input.dispatchEvent(new Event('input', { bubbles:true }))
  input.blur()
})
const render = () => root.render(<MemoryRouter><Workout/></MemoryRouter>)
const reopen = () => act(() => {
  const saved = JSON.parse(localStorage.getItem('gym_state_v1'))
  root.unmount(); root = createRoot(host)
  useStore.getState().replaceState(saved)
  render()
})

beforeEach(async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-02T12:00:00Z'))
  localStorage.clear(); await setLang('en')
  useUI.setState({ sheets:[], timer:null, work:null, appTourRequest:null, appTourWorkoutPreview:false })
  bindUI(useUI)
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount()); host.remove()
  useUI.getState().closeAll(); useUI.getState().stopRest(); useUI.getState().stopWork()
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks()
})

function start({ unit = 'kg', cfg = {} } = {}) {
  const target = { id:'0025', mode:'reps', bodyweight:false, setScheme:'topback', sets:3,
    topSets:1, backoffSets:2, weight:100, reps:6, topRepsMin:4, topRepsMax:6,
    backoffPct:10, prog:'off', ...cfg }
  useStore.setState({ user:null, S:{ ...structuredClone(DEF), unit, lang:'en', effort:'rir',
    hasCompletedOnboarding:true, hasCompletedAppTour:true,
    routines:[{ id:'routine-kept', name:'Synthetic Top and Back-off', ex:[target] }],
    routineOrder:['routine-kept'], workouts:[{ id:'history-kept', start:1, end:2, entries:[] }] } })
  act(() => { beginWorkout('routine-kept', 80); render() })
}

it.each([['kg',107.5], ['lb',110]])('restores automatic pending %s loads when Top changes after a manual Back-off and reopen', (unit, expected) => {
  start({ unit })
  const routine = structuredClone(state().routines), history = structuredClone(state().workouts)
  type(`Weight (${unit})`, 1, '83.125')
  type('Actual reps', 1, '7')
  expect(rows().map(row => row.w)).toEqual([100,83.125,83.125])
  expect(rows()[1].manualFields).toEqual({ w:true, r:true })
  reopen()
  expect(rows()[1]).toMatchObject({ w:83.125, r:7, manualFields:{ w:true, r:true } })
  type(`Weight (${unit})`, 0, '120')
  expect(rows().map(row => row.w)).toEqual([120,expected,expected])
  expect(rows()[1]).toMatchObject({ r:7, manualFields:{ r:true } })
  expect(rows()[1].manualFields.w).toBeUndefined()
  expect(state().routines).toEqual(routine); expect(state().workouts).toEqual(history)
  reopen()
  expect(rows().map(row => row.w)).toEqual([120,expected,expected])
  type(`Weight (${unit})`, 0, '130')
  expect(rows().slice(1).every(row => row.w === (unit === 'kg' ? 117.5 : 115))).toBe(true)
})

it.each([true, false])('starts the next routine with automatic loads after session overrides and preserves independent reps=%s', independentReps => {
  start({ cfg:independentReps ? { autoBackoffReps:false, backoffRepsMin:10, backoffRepsMax:12 } : {} })
  const routine = structuredClone(state().routines), priorHistory = structuredClone(state().workouts)
  type('Weight (kg)', 0, '123.125')
  type('Weight (kg)', 1, '83.375')
  const actualReps = independentReps ? 11 : 7
  type('Actual reps', 1, String(actualReps))
  const sessionId = state().active.id
  act(() => {
    vi.advanceTimersByTime(60_000)
    useStore.getState().update(S => S.active.entries[0].sets.forEach(row => {
      row.done = true; row.doneAt = Date.now()
    }))
    doFinishWorkout({ silent:true })
  })
  const finished = structuredClone(state().workouts.at(-1))
  expect(finished.entries[0].sets.map(row => row.w)).toEqual([123.125,83.375,83.375])
  expect(finished.entries[0].sets[1]).toMatchObject({ r:actualReps, manualFields:{ w:true, r:true } })
  expect(state().active).toBeNull()
  reopen()
  act(() => { vi.advanceTimersByTime(24 * 60 * 60 * 1000); beginWorkout('routine-kept', 80) })
  expect(state().active.id).not.toBe(sessionId)
  expect(rows().map(row => row.w)).toEqual([123.125,110,110])
  expect(rows().every(row => !row.done && !row.manualFields)).toBe(true)
  expect(rows().slice(1).map(row => row.r)).toEqual(independentReps ? [12,12] : [8,8])
  expect(state().routines).toEqual(routine)
  expect(state().workouts).toEqual([...priorHistory, finished])
  type('Weight (kg)', 0, '150')
  expect(rows().map(row => row.w)).toEqual([150,135,135])
  reopen()
  expect(rows().map(row => row.w)).toEqual([150,135,135])
  expect(state().workouts).toEqual([...priorHistory, finished])
})
