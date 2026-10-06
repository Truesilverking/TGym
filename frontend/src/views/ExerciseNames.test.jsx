// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { setLang, originalExerciseNameFor } from '../lib/i18n.js'
import { EXIDX, registerCustom } from '../lib/exercises.js'
import { bindUI } from '../components/ui.jsx'
import Modals from '../components/Modals.jsx'
import Library from './Library.jsx'
import Workout from './Workout.jsx'
import RoutineEdit from './RoutineEdit.jsx'
import Stats from './Stats.jsx'
import { exerciseDetailSheet, workoutDetailSheet } from '../sheets.jsx'

vi.mock('../lib/sound.js', () => ({ playAppSound: vi.fn(), vibrate: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: vi.fn(async () => ({})) }))
vi.mock('../components/Media.jsx', () => ({ default: () => null, Thumb: () => null }))
vi.mock('../components/ExerciseSessions.jsx', () => ({ default: props => <section data-selected-exercise={props.exerciseId}>{props.name}</section> }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, host
const state = () => useStore.getState().S
const update = fn => act(() => useStore.getState().update(fn))
const entry = (id, n) => ({ id, n, sg: 'pair', target: { mode: 'reps', reps: 8, weight: 40 }, sets: [{ w: 40, r: 8, done: false }] })
const headers = () => [...host.querySelectorAll('.exercise-heading > .grow')].map(e => e.textContent)
const titles = () => [...host.querySelectorAll('.library-list .tt')].map(e => e.textContent)
const setInput = (el, value) => act(() => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
})
const button = label => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === label)
const mount = (view, initialEntries = ['/']) => act(() => root.render(<MemoryRouter initialEntries={initialEntries}>{view}<Modals /></MemoryRouter>))

beforeEach(async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-06T12:00:00'))
  await setLang('en')
  localStorage.clear()
  useUI.setState({ sheets: [], timer: null, work: null, toastMsg: '' })
  bindUI(useUI)
  const S = structuredClone(DEF)
  Object.assign(S, {
    lang: 'en', exerciseNameMode: 'aliases', sound: false,
    customEx: [{ id: 'custom-names', n: 'My base movement', custom: true, bp: 'chest', tg: 'pectorals', eq: 'body weight', st: [] }],
    exerciseAliases: { '0025': 'Shared nickname', 'custom-names': 'Shared nickname' },
    routines: [{ id: 'names-plan', name: 'Name test', ex: [{ id: '0025', reps: 8, sets: 1 }, { id: 'custom-names', reps: 8, sets: 1 }] }],
    workouts: [{ id: 'historical-names', d: '2026-10-05', start: Date.now() - 86400000, end: Date.now() - 86400000 + 60000, routineId: 'names-plan', name: 'Name test', entries: [{ ...entry('deleted-names', 'Saved deleted original'), sets: [{ w: 25, r: 8, done: true }] }] }],
    active: { id: 'live-names', d: '2026-10-06', start: Date.now(), cur: 0, routineId: 'names-plan', name: 'Name test', entries: [entry('0025', 'Catalogue snapshot'), entry('custom-names', 'My base movement')] }
  })
  registerCustom(S.customEx)
  useStore.setState({ S, user: null })
  // Start from the same normalized snapshot that persisted sessions use in the app.
  useStore.getState().update(() => {}, false)
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  useUI.getState().stopRest()
  useUI.getState().stopWork()
  registerCustom([])
  vi.clearAllTimers()
  vi.useRealTimers()
})

it('updates an active superset without restarting, merging duplicate aliases or changing session records', () => {
  mount(<Workout />)
  const active = JSON.stringify(state().active)
  const history = JSON.stringify(state().workouts)
  const routines = JSON.stringify(state().routines)
  expect(headers()).toEqual(['Shared nickname', 'Shared nickname'])
  update(S => { S.exerciseNameMode = 'original' })
  expect(headers()).toEqual([originalExerciseNameFor(EXIDX['0025']), 'My base movement'])
  update(S => { S.exerciseAliases['0025'] = 'A long alias '.repeat(20) })
  expect(headers()[0]).toBe(originalExerciseNameFor(EXIDX['0025']))
  update(S => { S.exerciseNameMode = 'aliases' })
  expect(headers()[0]).toBe('A long alias '.repeat(20).trim())
  update(S => { S.exerciseAliases['0025'] = '   ' })
  expect(headers()[0]).toBe(originalExerciseNameFor(EXIDX['0025']))
  update(S => { delete S.exerciseAliases['custom-names'] })
  expect(headers()[1]).toBe('My base movement')
  expect(JSON.stringify(state().active)).toBe(active)
  expect(JSON.stringify(state().workouts)).toBe(history)
  expect(JSON.stringify(state().routines)).toBe(routines)
})

it('keeps both catalogue and alias search available in either display mode', () => {
  mount(<Library />)
  const search = host.querySelector('input[aria-label="Search…"]')
  setInput(search, 'Shared nickname')
  expect(titles().filter(s => s === 'Shared nickname')).toHaveLength(2)
  update(S => { S.exerciseNameMode = 'original' })
  expect(titles()).toContain(originalExerciseNameFor(EXIDX['0025']))
  expect(titles()).toContain('My base movement')
  expect(titles()).not.toContain('Shared nickname')
  setInput(search, 'My base movement')
  expect(titles()).toContain('My base movement')
  update(S => { S.exerciseNameMode = 'aliases' })
  expect(titles()).toContain('Shared nickname')
  update(S => { S.exerciseAliases['custom-names'] = 'Edited nickname' })
  expect(titles()).toContain('Edited nickname')
})

it('keeps the original consultable and applies saved alias edits and removal in an open detail sheet', () => {
  mount(null)
  act(() => exerciseDetailSheet(EXIDX['0025']))
  const dialog = host.querySelector('[role="dialog"]')
  const original = originalExerciseNameFor(EXIDX['0025'])
  expect(dialog.querySelector('h3').textContent).toBe('Shared nickname')
  expect(dialog.querySelector('.lrow-s').textContent).toBe(original)
  const alias = dialog.querySelector('input[placeholder="Personal alias (optional)"]')
  setInput(alias, 'Edited from detail')
  act(() => button('Save').click())
  expect(dialog.querySelector('h3').textContent).toBe('Edited from detail')
  update(S => { S.exerciseNameMode = 'original' })
  setInput(alias, 'Retained for later')
  act(() => button('Save').click())
  expect(dialog.querySelector('h3').textContent).toBe(original)
  expect(state().exerciseAliases['0025']).toBe('Retained for later')
  update(S => { S.exerciseNameMode = 'aliases' })
  expect(dialog.querySelector('h3').textContent).toBe('Retained for later')
  setInput(alias, '')
  act(() => button('Save').click())
  expect(dialog.querySelector('h3').textContent).toBe(original)
  expect(state().exerciseAliases).not.toHaveProperty('0025')
})

it('updates an already open superset chooser through mode and alias changes', () => {
  mount(<Workout />)
  act(() => button('Remove exercise').click())
  const dialog = host.querySelector('[role="dialog"]')
  expect([...dialog.querySelectorAll('.tt')].map(e => e.textContent)).toEqual(['Shared nickname', 'Shared nickname'])
  update(S => { S.exerciseNameMode = 'original' })
  expect([...dialog.querySelectorAll('.tt')].map(e => e.textContent)).toEqual([originalExerciseNameFor(EXIDX['0025']), 'My base movement'])
  update(S => { S.exerciseNameMode = 'aliases'; S.exerciseAliases['0025'] = 'Live edit' })
  expect([...dialog.querySelectorAll('.tt')].map(e => e.textContent)).toEqual(['Live edit', 'Shared nickname'])
  expect(state().active.entries.map(e => e.id)).toEqual(['0025', 'custom-names'])
})

it('keeps a missing-catalogue exercise original consultable from its active-session details', () => {
  update(S => { S.active.entries[0].id = 'live-orphan'; S.active.entries[0].n = 'Saved session original'; S.exerciseAliases['live-orphan'] = 'Session nickname' })
  mount(<Workout />)
  act(() => host.querySelector('button[aria-label="Details"]').click())
  const dialog = host.querySelector('[role="dialog"]')
  expect(dialog.querySelector('h3').textContent).toBe('Session nickname')
  expect(dialog.querySelector('.lrow-s').textContent).toBe('Saved session original')
  update(S => { S.exerciseNameMode = 'original' })
  expect(dialog.querySelector('h3').textContent).toBe('Saved session original')
})

it('refreshes a custom base name in an already open detail without losing its alias', () => {
  mount(null)
  act(() => exerciseDetailSheet(EXIDX['custom-names']))
  const dialog = host.querySelector('[role="dialog"]')
  update(S => { S.customEx[0].n = 'Renamed base movement' })
  expect(dialog.querySelector('h3').textContent).toBe('Shared nickname')
  expect(dialog.querySelector('.lrow-s').textContent).toBe('Renamed base movement')
  update(S => { S.exerciseNameMode = 'original' })
  expect(dialog.querySelector('h3').textContent).toBe('Renamed base movement')
  expect(state().exerciseAliases['custom-names']).toBe('Shared nickname')
})

it('renders orphaned history from the saved base name and aliases by ID without rewriting it', () => {
  mount(null)
  const history = JSON.stringify(state().workouts)
  act(() => workoutDetailSheet(state().workouts[0]))
  const title = () => host.querySelector('[role="dialog"] .tt').textContent.trim()
  expect(title()).toBe('Saved deleted original')
  update(S => { S.exerciseAliases['deleted-names'] = 'Orphan nickname' })
  expect(title()).toBe('Orphan nickname')
  update(S => { S.exerciseNameMode = 'original' })
  expect(title()).toBe('Saved deleted original')
  expect(JSON.stringify(state().workouts)).toBe(history)
})

it('updates routine entries by ID and retains their prescriptions under duplicate aliases', () => {
  const before = JSON.stringify(state().routines)
  mount(<Routes><Route path="/plan/r/:id" element={<RoutineEdit />} /></Routes>, ['/plan/r/names-plan'])
  const titles = () => [...host.querySelectorAll('.routine-exercise-open .tt')].map(e => e.textContent)
  expect(titles()).toEqual(['Shared nickname', 'Shared nickname'])
  update(S => { S.exerciseNameMode = 'original' })
  expect(titles()).toEqual([originalExerciseNameFor(EXIDX['0025']), 'My base movement'])
  expect(JSON.stringify(state().routines)).toBe(before)
})

it('keeps Stats exercise membership and the default chart ID stable when only preferred names change', () => {
  update(S => {
    S.exerciseAliases['0025'] = 'Zzz nickname'
    S.exerciseAliases['custom-names'] = 'Aaa nickname'
    S.exerciseAliases['name-only-alias'] = 'Alphabetically first alias'
    S.workouts[0].entries = [entry('0025', 'Catalogue snapshot'), entry('custom-names', 'My base movement'), { ...entry('name-only-alias'), n: undefined }]
    S.workouts[0].entries.forEach(e => { e.sets[0].done = true })
    S.statsSections = ['exercise']
  })
  mount(<Stats />)
  const selected = () => host.querySelector('[data-selected-exercise]')
  expect(selected().dataset.selectedExercise).toBe('0025')
  expect(selected().textContent).toBe('Zzz nickname')
  update(S => { S.exerciseNameMode = 'original' })
  expect(selected().dataset.selectedExercise).toBe('0025')
  expect(selected().textContent).toBe(originalExerciseNameFor(EXIDX['0025']))
  update(S => { S.exerciseNameMode = 'aliases'; S.exerciseAliases['0025'] = 'Different displayed nickname' })
  expect(selected().dataset.selectedExercise).toBe('0025')
  expect(selected().textContent).toBe('Different displayed nickname')
  act(() => host.querySelector('.exercise-progress .lrow-select').click())
  const dialog = host.querySelector('[role="dialog"]')
  const labels = () => [...dialog.querySelectorAll('.lrow-t')].map(e => e.textContent)
  expect(labels()).toHaveLength(2)
  expect(labels().join(' ')).not.toContain('Alphabetically first alias')
  expect(labels().join(' ')).toContain('Different displayed nickname')
  update(S => { S.exerciseNameMode = 'original' })
  expect(labels().join(' ')).not.toContain('Different displayed nickname')
  expect(labels().join(' ')).toContain(originalExerciseNameFor(EXIDX['0025']))
})
