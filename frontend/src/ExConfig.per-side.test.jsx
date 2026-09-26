// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { exConfigSheet } from './sheets.jsx'
import { exOr } from './lib/exercises.js'
import Modals from './components/Modals.jsx'

vi.mock('./components/Media.jsx', () => ({ default: () => null }))
globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, container, saved
const input = name => container.querySelector(`input[aria-label="${name}"]`)
const type = (name, value) => act(() => {
  const field = input(name)
  field.focus()
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, value)
  field.dispatchEvent(new Event('input', { bubbles: true }))
})
const click = text => act(() => [...container.querySelectorAll('button')].find(b => b.textContent === text).click())
const bump = name => act(() => input(name).closest('.stp').querySelector('[aria-label="Increase"]').click())
function mount(cfg) {
  const S = structuredClone(DEF)
  S.lang = 'en'
  useStore.setState({ S, user: null })
  saved = vi.fn()
  act(() => { root.render(<Modals />); exConfigSheet(exOr('0025'), { sets: 3, mode: 'reps', bodyweight: false, weight: 20, ...cfg }, saved) })
}
beforeEach(() => {
  vi.useFakeTimers()
  useUI.setState({ sheets: [] })
  container = document.createElement('div'); document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => { act(() => root.unmount()); container.remove(); vi.clearAllTimers(); vi.useRealTimers() })

it.each([{ side: true, reps: 16 }, { side: true, repsPerSide: true, reps: 8 }])('edits 8 per side in single steps and saves compatible storage %j', cfg => {
  mount(cfg)
  expect(input('Reps').value).toBe('8')
  bump('Reps'); expect(input('Reps').value).toBe('9')
  type('Reps', '8'); click('Save')
  expect(saved).toHaveBeenCalledWith(expect.objectContaining(cfg))
})
it('keeps ordinary reps unchanged and retains the visible number when toggling sides', () => {
  mount({ side: true, reps: 16, repsMin: 12, repRange: true })
  const toggle = () => act(() => [...container.querySelectorAll('.lrow')].find(row => row.textContent.includes('Reps per side')).querySelector('[role="switch"]').click())
  toggle(); expect(input('Reps').value).toBe('8'); expect(input('Minimum reps').value).toBe('6')
  toggle(); expect(input('Reps').value).toBe('8'); click('Save')
  expect(saved).toHaveBeenCalledWith(expect.objectContaining({ side: true, repsPerSide: true, reps: 8, repsMin: 6 }))
})
it('shows legacy rep ranges and back-off prescriptions in per-side units', () => {
  mount({ side: true, reps: 16, repsMin: 12, repRange: true, setScheme: 'topback', autoBackoffReps: false, backoffRepsMin: 16, backoffRepsMax: 20 })
  expect(input('Minimum reps').value).toBe('6'); expect(input('Maximum reps').value).toBe('8')
  expect(input('Back-off min reps').value).toBe('8'); expect(input('Back-off max reps').value).toBe('10')
  type('Minimum reps', '7'); type('Back-off max reps', '11'); click('Save')
  expect(saved).toHaveBeenCalledWith(expect.objectContaining({ repsMin: 14, reps: 16, backoffRepsMin: 16, backoffRepsMax: 22 }))
})
it('uses per-side reps for rest-pause plans', () => {
  mount({ side: true, reps: 16, intensifier: { type: 'restpause', totalReps: 24, restSec: 15 } })
  expect(input('Rest-pause reps').value).toBe('12'); bump('Rest-pause reps'); click('Save')
  expect(saved).toHaveBeenCalledWith(expect.objectContaining({ intensifier: { type: 'restpause', totalReps: 26, restSec: 15 } }))
})
