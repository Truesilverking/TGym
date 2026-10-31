// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import RestTimer from './RestTimer.jsx'
import { useStore, DEF } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { exerciseNameFor } from '../lib/i18n.js'

let root, host
const exercise = { id: 'custom-hold', n: 'Base hold' }
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-06T16:00:00Z'))
  useStore.setState({ S: { ...structuredClone(DEF), exerciseAliases: { [exercise.id]: 'My hold' }, active: {
    id: 'active-hold', start: Date.now(), lastMeaningfulWorkoutActivityAt: Date.now(), entries: [{ id: exercise.id, sets: [{ sec: 90, done: false }] }]
  } }, user: null })
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => { useUI.getState().stopWork(); useUI.getState().stopRest(); root.unmount() })
  host.remove()
  vi.useRealTimers()
})

it('updates a running hold name after mode and alias edits without restarting or logging it', () => {
  const done = vi.fn()
  act(() => {
    useUI.getState().startWork(90, exerciseNameFor(exercise), done, true, () => `${exerciseNameFor(exercise)} · Left side`)
    root.render(<RestTimer />)
  })
  const deadline = useUI.getState().work.endsAt
  const active = structuredClone(useStore.getState().S.active)
  expect(host.querySelector('.lbl').textContent).toBe('My hold · Left side')
  act(() => useStore.getState().update(s => { s.exerciseNameMode = 'original' }))
  expect(host.querySelector('.lbl').textContent).toBe('Base hold · Left side')
  act(() => useStore.getState().update(s => { s.exerciseAliases[exercise.id] = 'Edited hold' }))
  expect(host.querySelector('.lbl').textContent).toBe('Base hold · Left side')
  act(() => useStore.getState().update(s => { s.exerciseNameMode = 'aliases' }))
  expect(host.querySelector('.lbl').textContent).toBe('Edited hold · Left side')
  act(() => useStore.getState().update(s => { delete s.exerciseAliases[exercise.id] }))
  expect(host.querySelector('.lbl').textContent).toBe('Base hold · Left side')
  expect(useUI.getState().work.endsAt).toBe(deadline)
  expect(useUI.getState().work.left).toBe(90)
  expect(useStore.getState().S.active).toEqual(active)
  expect(done).not.toHaveBeenCalled()
  act(() => vi.advanceTimersByTime(38000))
  expect(useUI.getState().work.endsAt).toBe(deadline)
  expect(useUI.getState().work.left).toBe(52)
  act(() => useUI.getState().finishWorkEarly())
  expect(done).toHaveBeenCalledExactlyOnceWith(38, { timedOut: false })
})

it('preserves non-exercise timer labels and deadline behavior for existing callers', () => {
  act(() => { useUI.getState().startWork(30, 'Countdown', vi.fn()); root.render(<RestTimer />) })
  const deadline = useUI.getState().work.endsAt
  act(() => useStore.getState().update(s => { s.exerciseNameMode = 'original' }))
  expect(host.querySelector('.lbl').textContent).toBe('Countdown')
  expect(useUI.getState().work.endsAt).toBe(deadline)
})
