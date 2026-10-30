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

async function openActiveWeightRuler() {
  const now=Date.now()
  mirror.value={...structuredClone(DEF),lang:'en',hasCompletedOnboarding:true,hasCompletedAppTour:true,sound:false,
    active:{id:'ruler-input',d:todayISO(),start:now-60000,lastUserInteractionAt:now,entries:[{id:'0025',target:{mode:'reps'},sets:[{done:false,w:20,r:8}]}]}}
  await mount();await click('Log')
  return host.querySelector('.bodyweight-picker-ruler')
}
async function rulerPointer(target,type,{trusted=true,buttons=1,primary=true,x=200}={}) {
  await act(()=>{
    const event=new MouseEvent(type,{bubbles:true,cancelable:true,button:0,buttons,clientX:x,clientY:30})
    Object.defineProperties(event,{isTrusted:{value:trusted},isPrimary:{value:primary},pointerId:{value:1}})
    target.dispatchEvent(event)
  })
}

it('records only trusted pressed primary ruler movement, excluding hover and other controls',async()=>{
  const ruler=await openActiveWeightRuler(),record=vi.spyOn(useStore.getState(),'recordInteraction')
  await rulerPointer(ruler,'pointermove',{buttons:0})
  await rulerPointer(ruler,'pointermove',{trusted:false})
  await rulerPointer(ruler,'pointermove',{primary:false})
  await rulerPointer(host.querySelector('h1'),'pointermove')
  expect(record).not.toHaveBeenCalled()
  const captured=Date.now()
  await rulerPointer(ruler,'pointermove')
  expect(record).toHaveBeenCalledExactlyOnceWith(captured,{defer:true,quietMs:1800})
})

it('renews the ruler quiet period from actual drag movement before the old quiet deadline',async()=>{
  const ruler=await openActiveWeightRuler(),record=vi.spyOn(useStore.getState(),'recordInteraction')
  const now=Date.now(),stored=localStorage.getItem('gym_state_v1'),workouts=structuredClone(useStore.getState().S.workouts)
  await rulerPointer(ruler,'pointerdown')
  expect(record).toHaveBeenLastCalledWith(now,{defer:true,quietMs:1800})
  await act(async()=>vi.advanceTimersByTimeAsync(1000))
  await rulerPointer(ruler,'pointermove',{x:185})
  expect(record).toHaveBeenLastCalledWith(now+1000,{defer:true,quietMs:1800})
  await act(async()=>vi.advanceTimersByTimeAsync(801))
  expect(localStorage.getItem('gym_state_v1')).toBe(stored)
  expect(useStore.getState().reconcileActiveClock().lastUserInteractionAt).toBe(now+1000)
  await rulerPointer(ruler,'pointermove',{x:170})
  expect(record).toHaveBeenLastCalledWith(now+1801,{defer:true,quietMs:1800})
  expect(useStore.getState().S.workouts).toEqual(workouts)
  await rulerPointer(ruler,'pointercancel',{x:170})
})

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

it('blocks authenticated routes and profile controls until saved resource hydration is ready', async () => {
  const boot = useStore.getState().boot
  useStore.setState({ user: { id: 'authenticated' }, ready: false, boot: vi.fn(async () => {}) })
  try {
    await mount()
    expect(host.querySelector('#app')).not.toBeNull()
    expect(host.querySelector('#tabbar')).toBeNull()
    expect(host.querySelector('.app-update')).toBeNull()
    expect(host.textContent).not.toContain('Consistency')
    expect(host.textContent).not.toContain('Start')
    expect(localStorage.getItem('gym_state_v1')).toBeNull()
  } finally { useStore.setState({ boot }) }
})

it.each(['en', 'es'])('does not infer a full device from a primary storage warning in %s', async lang => {
  useStore.setState({S:{...structuredClone(DEF),lang,hasCompletedOnboarding:true,hasCompletedAppTour:true}})
  await setLang(lang); await mount()
  await act(() => useStore.setState({storageWarning:'primary'}))
  const warning = host.querySelector('aside.offline-status[role="alert"]')
  expect(warning.textContent).toBe(t('Could not save changes. Try again.'))
  expect(warning.textContent).not.toBe(t('Could not save changes. Free device storage and try again.'))
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
  await mount(); await act(()=>host.querySelector('#navigation-dock-toggle').click()); await click('Routine')
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

it('records trusted recovery input after controlled onChange and persists the reviewed duration', async () => {
  const now=Date.now(),minute=60000
  mirror.value={...structuredClone(DEF),lang:'en',hasCompletedOnboarding:true,hasCompletedAppTour:true,sound:false,
    active:{id:'recovery-input',d:todayISO(),start:now-45*minute,name:'Recovery input',lastUserInteractionAt:now-40*minute,timerPausedAt:now-10*minute,pauseReason:'inactivity',entries:[{id:'0025',target:{mode:'reps'},sets:[{done:false,w:20,r:8}]}]}}
  await mount()
  expect(host.querySelector('.inactivity-editor input')).toBeNull()
  await click('Update time')
  const field=host.querySelector('.inactivity-editor input')
  expect(field.value).toBe('35')
  vi.setSystemTime(now+1000)
  await act(()=>{
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,'40')
    const input=new Event('input',{bubbles:true})
    Object.defineProperty(input,'isTrusted',{value:true})
    field.dispatchEvent(input)
  })
  expect(field.value).toBe('40')
  // Trusted input metadata is persisted after the input burst and first paint; its timestamp is
  // still the input time rather than the later batched storage write.
  await act(async()=>vi.advanceTimersByTimeAsync(900))
  expect(useStore.getState().S.active.lastUserInteractionAt).toBe(now+1000)
  await click('Save duration')
  expect(useStore.getState().S.active.accumulatedActiveDuration).not.toBe(40*minute)
  await click('Save changes')
  expect(useStore.getState().S.active.accumulatedActiveDuration).toBe(40*minute)
  expect(useStore.getState().S.active.pauseReason).toBe('inactivity')
  expect(useStore.getState().S.workouts).toEqual([])
  noRenderFailures()
})
