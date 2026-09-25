// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Workout from './Workout.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { playAppSound } from '../lib/sound.js'

vi.mock('../lib/sound.js', () => ({ playAppSound: vi.fn(), vibrate: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, container
beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  useUI.getState().stopRest()
  useUI.getState().stopWork()
  useUI.setState({ sheets: [], toastMsg: '', timer: null, work: null })
  playAppSound.mockClear()
  root = null; container = null
})
afterEach(() => {
  if (root) act(() => root.unmount())
  container?.remove()
  useUI.getState().stopRest()
  useUI.getState().stopWork()
  vi.clearAllTimers()
  vi.useRealTimers()
})

function renderTimed({ side = false, seconds = 2, mode = 'time' } = {}) {
  const S = structuredClone(DEF)
  S.active = { id: 'sound-test', d: '2026-09-23', start: Date.now(), routineId: null,
    name: 'Hold', bw: null, cur: 0, entries: [{ id: '1001',
      target: { mode, side, sec: seconds, sets: 1 },
      sets: [{ sec: seconds, min: 1, done: false }]
    }] }
  useStore.setState({ S, user: null })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<MemoryRouter><Workout /></MemoryRouter>))
  act(() => container.querySelector('.setrow .setgo').click())
}
const alerts = () => playAppSound.mock.calls.map(([, event]) => event).filter(event => event !== 'countdown')
const saved = () => useStore.getState().S.active.entries[0].sets[0]

describe('timed-set sound ownership', () => {
  it.each(['time', 'cardio'])('keeps the work-finished cue when a %s timer logs its set', mode => {
    renderTimed({ mode })
    act(() => vi.advanceTimersByTime(mode === 'cardio' ? 60000 : 2000))
    expect(alerts()).toEqual(['work'])
    expect(saved().done).toBe(true)
    expect(useUI.getState().work).toBe(null)
  })

  it('keeps the set cue when the user finishes a hold early', () => {
    renderTimed({ seconds: 5 })
    act(() => vi.advanceTimersByTime(1000))
    act(() => useUI.getState().finishWorkEarly())
    expect(alerts()).toEqual(['set'])
    expect(saved().done).toBe(true)
    expect(saved().sec).toBe(1)
  })

  it('plays each side completion once, without replacing the final cue with set completion', () => {
    renderTimed({ side: true })
    act(() => vi.advanceTimersByTime(4700))
    expect(alerts()).toEqual(['work', 'work'])
    expect(saved()).toMatchObject({ done: true, leftSec: 2, rightSec: 2 })
  })
})

it('cancels timed work before inserting a warmup changes row indexes',()=>{
 renderTimed({seconds:5});act(()=>container.querySelector('button[aria-label="Add set"]').click());
 act(()=>[...container.querySelectorAll('button')].find(b=>b.textContent==='Add warm-up set').click());
 act(()=>vi.advanceTimersByTime(6000));expect(useUI.getState().work).toBe(null);expect(useStore.getState().S.active.entries[0].sets.every(s=>!s.done)).toBe(true)
})
it('cancels the delayed right-side callback when the row structure changes',()=>{
 renderTimed({side:true});act(()=>vi.advanceTimersByTime(2000));
 act(()=>[...container.querySelectorAll('button')].find(b=>b.textContent==='Add warm-up set').click());
 act(()=>vi.advanceTimersByTime(3000));expect(useUI.getState().work).toBe(null);expect(useStore.getState().S.active.entries[0].sets.every(s=>!s.done)).toBe(true)
})
