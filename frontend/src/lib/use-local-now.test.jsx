// @vitest-environment happy-dom
import React, { act, StrictMode, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useLocalNow } from './use-local-now.js'
import { isoOf, localTZ } from './format.js'
import { setLang } from './i18n.js'
import Home from '../views/Home.jsx'
import { DEF, useStore } from '../store/useStore.js'

let root, host, visibility, previousTZ, renders
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  previousTZ = process.env.TZ
  process.env.TZ = 'America/Santo_Domingo'
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-02T23:59:00-04:00'))
  visibility = 'visible'; renders = 0
  vi.spyOn(document,'visibilityState','get').mockImplementation(() => visibility)
  localStorage.clear()
  useStore.setState({S:structuredClone(DEF),user:null})
  await setLang('en')
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount()); host.remove()
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks()
  if (previousTZ == null) delete process.env.TZ; else process.env.TZ = previousTZ
})
function ClockProbe() {
  const now = useLocalNow()
  renders++
  return <output>{isoOf(now)}|{now.getTimezoneOffset()}|{localTZ()}|{now.toISOString()}</output>
}
const mountProbe = (strict = false) => act(() => root.render(strict ? <StrictMode><ClockProbe/></StrictMode> : <ClockProbe/>))
const mountHome = () => {
  const S = {...structuredClone(DEF),lang:'en',trainingStartDate:'2026-10-01',routines:[{id:'r',name:'Routine',ex:[]}],week:{4:['r'],5:['r']},workouts:[{id:'one',d:'2026-10-01',routineId:'r',entries:[{id:'e',sets:[{done:true,r:8,w:10}]}]}]}
  useStore.setState({S})
  act(() => root.render(<MemoryRouter><Home/></MemoryRouter>))
  return S
}
const streak = () => host.querySelector('.header-streak b').textContent
const metric = label => [...host.querySelectorAll('dt')].find(el => el.textContent === label)?.nextElementSibling.textContent

it.each(['midnight','timezone'])('refreshes immediately when %s changes between render and effect setup', change => {
  vi.setSystemTime(new Date(change === 'midnight' ? '2026-10-02T23:59:59-04:00' : '2026-10-03T12:00:00-04:00'))
  function ClockRace() {
    const now = useLocalNow()
    useLayoutEffect(() => {
      if (change === 'midnight') vi.setSystemTime(new Date('2026-10-03T00:00:01-04:00'))
      else process.env.TZ = 'America/New_York'
    }, [])
    return <output>{isoOf(now)}|{localTZ()}|{now.toISOString()}</output>
  }
  act(() => root.render(<ClockRace/>))
  expect(host.textContent).toContain(change === 'midnight' ? '2026-10-03|America/Santo_Domingo|2026-10-03T04:00:01.000Z' : '2026-10-03|America/New_York')
  expect(vi.getTimerCount()).toBe(2)
  act(() => root.render(null))
  expect(vi.getTimerCount()).toBe(0)
})

it('refreshes Home at local midnight without editing or persisting the profile', () => {
  const S = mountHome(), update = vi.spyOn(useStore.getState(),'update'), write = vi.spyOn(localStorage,'setItem')
  expect(streak()).toBe('1'); expect(metric('Completion')).toBe('100%')
  expect(host.querySelector('.hdr-center .sub').textContent).toContain('Friday')
  act(() => vi.advanceTimersByTime(60001))
  expect(streak()).toBe('0'); expect(metric('Completion')).toBe('50%')
  expect(host.querySelector('.hdr-center .sub').textContent).toContain('Saturday')
  expect(useStore.getState().S).toBe(S)
  expect(update).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled()
})

it('refreshes Home on foreground after crossing midnight while suspended', () => {
  const S = mountHome()
  visibility = 'hidden'; act(() => document.dispatchEvent(new Event('visibilitychange')))
  vi.setSystemTime(new Date('2026-10-03T08:00:00-04:00'))
  act(() => vi.advanceTimersByTime(60000))
  expect(streak()).toBe('1')
  visibility = 'visible'; act(() => document.dispatchEvent(new Event('visibilitychange')))
  expect(streak()).toBe('0'); expect(metric('Completion')).toBe('50%')
  expect(useStore.getState().S).toBe(S)
})

it.each(['focus','pageshow'])('refreshes Home on %s without waiting for a poll or store change', event => {
  const S = mountHome()
  vi.setSystemTime(new Date('2026-10-03T00:01:00-04:00'))
  act(() => window.dispatchEvent(new Event(event)))
  expect(streak()).toBe('0')
  expect(host.querySelector('.hdr-center .sub').textContent).toContain('Saturday')
  expect(useStore.getState().S).toBe(S)
})

it('refreshes visible UI for a timezone-ID change with the same day and UTC offset, then for an offset change', () => {
  vi.setSystemTime(new Date('2026-10-03T16:00:00Z')); mountProbe()
  expect(host.textContent).toContain('2026-10-03|240|America/Santo_Domingo')
  const initial = renders
  process.env.TZ = 'America/New_York'
  act(() => vi.advanceTimersByTime(30000))
  expect(host.textContent).toContain('2026-10-03|240|America/New_York')
  expect(renders).toBeGreaterThan(initial)
  process.env.TZ = 'UTC'
  act(() => vi.advanceTimersByTime(30000))
  expect(host.textContent).toContain('2026-10-03|0|UTC')
})

it('detects a system-clock day jump on the next visible poll', () => {
  mountProbe()
  vi.setSystemTime(new Date('2026-10-05T12:00:00-04:00'))
  act(() => vi.advanceTimersByTime(30000))
  expect(host.textContent).toContain('2026-10-05|240|America/Santo_Domingo')
})

it('does not rerender for unchanged visible clock checks or while hidden, and uses a fresh date on resume', () => {
  vi.setSystemTime(new Date('2026-10-02T12:00:00-04:00')); mountProbe()
  const initial = renders
  act(() => vi.advanceTimersByTime(90000))
  expect(renders).toBe(initial)
  visibility = 'hidden'; act(() => document.dispatchEvent(new Event('visibilitychange')))
  vi.setSystemTime(new Date('2026-10-03T12:00:00-04:00'))
  act(() => vi.advanceTimersByTime(90000)); act(() => window.dispatchEvent(new Event('focus')))
  expect(renders).toBe(initial)
  visibility = 'visible'; act(() => document.dispatchEvent(new Event('visibilitychange')))
  expect(host.textContent).toContain('2026-10-03|240|America/Santo_Domingo')
})

it('uses a fresh snapshot on ordinary rerenders and removes timers/listeners through StrictMode remounts', () => {
  mountProbe(true)
  expect(vi.getTimerCount()).toBe(2)
  vi.setSystemTime(new Date('2026-10-02T23:59:20-04:00'))
  act(() => root.render(<StrictMode><ClockProbe/></StrictMode>))
  expect(host.textContent).toContain('2026-10-03T03:59:20.000Z')
  act(() => root.render(null))
  expect(vi.getTimerCount()).toBe(0)
  const before = renders
  act(() => {
    window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('pageshow'))
    document.dispatchEvent(new Event('visibilitychange')); vi.advanceTimersByTime(90000)
  })
  expect(renders).toBe(before)
  mountProbe(true)
  expect(vi.getTimerCount()).toBe(2)
})
