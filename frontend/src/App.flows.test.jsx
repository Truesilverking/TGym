// @vitest-environment happy-dom
// DOM/store integration, not a substitute for browser layout or physical-device QA.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App.jsx'
import { useStore, DEF } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { buildDemoState } from './lib/demoSeed.js'
import { setLang, t } from './lib/i18n.js'
import { todayISO } from './lib/format.js'
import { dailyPlan } from './lib/daily-plan.js'

const mirror = vi.hoisted(() => ({ value: null }))
vi.mock('./lib/demo.js', () => ({ STANDALONE: true, DEMO: false, DEMO_SEEDED: 'test' }))
vi.mock('./lib/web-state.js', () => ({
  loadWebState: async () => mirror.value,
  saveWebState: async state => { mirror.value = structuredClone(state); return true },
}))
let host, root, errors
beforeEach(async () => {
  vi.useFakeTimers(); localStorage.clear(); sessionStorage.clear(); mirror.value = null
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })))
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  errors = vi.spyOn(console, 'error').mockImplementation(() => {})
  useStore.setState({ S: { ...structuredClone(DEF), lang: 'en' }, user: null, ready: false, storageError: null, needsMobileOnboarding: false })
  useUI.setState({ sheets: [], timer: null, work: null, appTourRequest: null })
  window.history.replaceState(null, '', '#/home')
  await setLang('en')
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => {
  await act(() => root.unmount()); host.remove()
  useUI.getState().stopRest(); useUI.getState().stopWork()
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals()
})
const mount = async () => { await act(async () => { root.render(<App />) }) }
const button = text => [...host.querySelectorAll('button')].find(el => el.textContent.trim() === text)
async function click(text) {
  const target = button(text)
  expect(target, `Missing button: ${text}`).toBeTruthy()
  await act(async () => { target.click() })
}
async function route(path) {
  await act(async () => { window.history.pushState(null, '', '#' + path); window.dispatchEvent(new PopStateEvent('popstate')) })
}
function noRenderFailures() {
  expect(errors.mock.calls.filter(args => args.some(arg => arg instanceof Error || String(arg).includes('render error')))).toEqual([])
  expect(host.textContent).not.toContain(t('This screen could not be drawn. Your data is safe on this device.'))
}
async function type(field, value) {
  await act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, value)
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

it.each([['en', 'dark'], ['en', 'light'], ['es', 'dark'], ['es', 'light']])('boots a populated profile and navigates all routes in %s/%s', async (lang, theme) => {
  const populated = { ...structuredClone(DEF), ...buildDemoState(), hasCompletedOnboarding: true, hasCompletedAppTour: true, lang, theme, reduceMotion: true, cloudSync: { on: false } }
  mirror.value = structuredClone(populated)
  await setLang(lang); await mount()
  expect(document.documentElement.dataset.theme).toBe(theme)
  expect(document.documentElement.dataset.reduceMotion).toBe('true')
  const historyIds = useStore.getState().S.workouts.map(w => w.id)
  const routineId = useStore.getState().S.routines[0].id
  for (const path of ['/home', '/plan', `/plan/r/${routineId}`, '/workout', '/stats', '/history', '/library', '/settings', '/admin', '/missing']) {
    await route(path)
    expect(host.querySelector('#app').textContent.length).toBeGreaterThan(20)
    noRenderFailures()
  }
  expect(useStore.getState().S.workouts.map(w => w.id)).toEqual(historyIds)
})

it('completes first setup, skips the tour and reopens with preferences intact', async () => {
  await mount()
  expect(useStore.getState().needsMobileOnboarding).toBe(true)
  await click('Continue')
  await click('lb'); await click('Continue')
  await click('Continue')
  const scratch = [...host.querySelectorAll('.item')].find(el => el.textContent.includes('Create from scratch'))
  await act(() => scratch.click())
  await click('120s'); await click('Continue')
  await click('Skip for now')
  await click('Start using TGym')
  expect(useStore.getState().needsMobileOnboarding).toBe(false)
  expect(host.querySelector('.app-tour')).toBeTruthy()
  await click('Skip')
  expect(mirror.value).toMatchObject({ hasCompletedOnboarding: true, hasCompletedAppTour: true, lang: 'en', unit: 'lb', measurementUnit: 'in', restSec: 120 })
  await act(() => root.unmount())
  localStorage.clear()
  useStore.setState({ S: structuredClone(DEF), user: null, ready: false })
  root = createRoot(host); await mount()
  expect(useStore.getState().needsMobileOnboarding).toBe(false)
  expect(host.querySelector('.app-tour')).toBeNull()
  expect(useStore.getState().S.unit).toBe('lb')
  noRenderFailures()
})

it('can skip optional PIN setup after typing an incomplete value', async () => {
  await mount()
  for (let step = 0; step < 3; step++) await click('Continue')
  await act(() => [...host.querySelectorAll('.item')].find(el => el.textContent.includes('Create from scratch')).click())
  await click('Continue')
  await type(host.querySelector('input[type=password]'), '1')
  await click('Skip for now')
  expect(button('Start using TGym')).toBeTruthy()
})

it('starts scheduled work, navigates away, resumes, cancels early finish, then saves once and advances the daily plan', async () => {
  const ex = { id: '0025', mode: 'reps', sets: 2, reps: 10, weight: 20, warmup: 0, prog: 'off' }
  mirror.value = { ...structuredClone(DEF), lang: 'en', hasCompletedOnboarding: true, hasCompletedAppTour: true, sound: false,
    routines: [{ id: 'first', name: 'QA first', ex: [ex] }, { id: 'second', name: 'QA second', ex: [ex] }],
    dayPlan: { [todayISO()]: ['first', 'second'] }, effort: 'none' }
  await mount(); await click('Start'); await click('Start without weighing in')
  const started = useStore.getState().S.active
  expect(started.routineId).toBe('first')
  vi.setSystemTime(Date.now() + 60000)
  await act(() => host.querySelector('[role=checkbox]').click())
  expect(useStore.getState().S.active.entries[0].sets[0].done).toBe(true)
  await click('Stats'); await click('Resume')
  expect(useStore.getState().S.active.id).toBe(started.id)
  await act(() => host.querySelector('button[aria-label=Finish]').click())
  await click('Cancel')
  expect(useStore.getState().S.active.timerPausedAt).toBeUndefined()
  expect(useStore.getState().S.workouts).toEqual([])
  await act(() => host.querySelector('button[aria-label=Finish]').click())
  await click('Finish workout')
  expect(useStore.getState().S.active).toBeNull()
  expect(useStore.getState().S.workouts).toHaveLength(1)
  expect(useStore.getState().S.workouts[0].id).toBe(started.id)
  expect(dailyPlan(useStore.getState().S, todayISO()).pending.map(r => r.id)).toEqual(['second'])
  await click('Later'); await route('/history')
  expect(host.textContent).toContain('QA first')
  expect(mirror.value.workouts[0].entries[0].sets[0].done).toBe(true)
  noRenderFailures()
})

it('cancels bulk routine deletion, then deletes and undoes without changing history or schedule', async () => {
  const data = { ...structuredClone(DEF), ...buildDemoState(), lang: 'en', hasCompletedOnboarding: true, hasCompletedAppTour: true }
  mirror.value = structuredClone(data)
  await mount(); await click('Routine')
  const before = structuredClone(useStore.getState().S)
  await click('Delete all routines'); await click('Cancel')
  expect(useStore.getState().S.routines).toEqual(before.routines)
  await click('Delete all routines'); await click('Delete all')
  expect(useStore.getState().S.routines).toEqual([])
  await click('Undo')
  expect(useStore.getState().S.routines).toEqual(before.routines)
  expect(useStore.getState().S.week).toEqual(before.week)
  expect(useStore.getState().S.workouts).toEqual(before.workouts)
  noRenderFailures()
})
