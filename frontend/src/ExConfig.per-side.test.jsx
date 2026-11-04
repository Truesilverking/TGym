// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { exConfigSheet } from './sheets.jsx'
import { exOr } from './lib/exercises.js'
import Modals from './components/Modals.jsx'
import { bindUI } from './components/ui.jsx'

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
it.each(['reps', 'time'])('retains transferred loading and rest rules after editing a %s prescription', mode => {
  const transferred = { loadingStep: 5, warmupRestSec: 20, supersetMoveRestSec: 10, supersetRoundRestSec: 150 }
  mount({ mode, reps: 8, sec: 45, restSec: 75, ...transferred })
  click('Save')
  expect(saved).toHaveBeenCalledWith(expect.objectContaining({ ...transferred, restSec: 75 }))
})
beforeEach(() => {
  vi.useFakeTimers()
  bindUI(useUI)
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

it('updates both Back-off range limits when the Top range is edited instead of reusing stale topRepsMin',()=>{
 mount({setScheme:'topback',repRange:true,reps:6,repsMin:4,topRepsMin:4,topRepsMax:6,backoffRepOffset:0,backoffRepsMin:4,backoffRepsMax:6})
 expect(input('Back-off rep offset')).toBeNull()
 expect(container.textContent).toContain('Increased reps')
 type('Maximum reps','10');type('Minimum reps','8');click('Save')
 expect(saved).toHaveBeenCalledWith(expect.objectContaining({topRepsMin:8,topRepsMax:10,backoffRepsMin:10,backoffRepsMax:12,backoffRepOffset:2}))
})
it('saves a fixed Top target with a fixed Back-off target two reps higher',()=>{
 mount({setScheme:'topback',repRange:false,reps:5,topRepsMin:3,topRepsMax:5})
 click('Save');expect(saved).toHaveBeenCalledWith(expect.objectContaining({topRepsMin:5,topRepsMax:5,backoffRepsMin:7,backoffRepsMax:7}))
})

it.each([
 {backoffRepsOverride:true,backoffRepsMode:'same',backoffRepOffset:0,expectedMin:4,expectedMax:6},
 {backoffRepsOverride:true,backoffRepOffset:4,expectedMin:8,expectedMax:10},
])('preserves explicit imported automatic rules while editing other fields %j',cfg=>{
 const {expectedMin,expectedMax,...rule}=cfg
 mount({setScheme:'topback',repRange:true,reps:6,repsMin:4,topRepsMin:4,topRepsMax:6,...rule})
 click('Save')
 expect(saved).toHaveBeenCalledWith(expect.objectContaining({...rule,backoffRepsMin:expectedMin,backoffRepsMax:expectedMax}))
 if(!rule.backoffRepsMode)expect(saved.mock.calls[0][0]).not.toHaveProperty('backoffRepsMode')
})

it('lets an explicit legacy exception return to the app setting',()=>{
 mount({setScheme:'topback',repRange:true,reps:6,repsMin:4,backoffRepsOverride:true,backoffRepOffset:4})
 act(()=>[...container.querySelectorAll('button.lrow')].find(button=>button.querySelector('.lrow-t')?.textContent==='Back-off repetitions').click())
 click('Follow app setting');click('Save')
 const value=saved.mock.calls[0][0]
 expect(value).not.toHaveProperty('backoffRepsOverride')
 expect(value).toMatchObject({backoffRepsMode:'increased',backoffRepOffset:2,backoffRepsMin:6,backoffRepsMax:8})
})

it('lets an inherited automatic target become a same-reps exception without changing Settings',()=>{
 mount({setScheme:'topback',repRange:false,reps:5})
 act(()=>[...container.querySelectorAll('button.lrow')].find(button=>button.querySelector('.lrow-t')?.textContent==='Back-off repetitions').click())
 click('Same reps');click('Save')
 expect(saved).toHaveBeenCalledWith(expect.objectContaining({backoffRepsOverride:true,backoffRepsMode:'same',backoffRepsMin:5,backoffRepsMax:5}))
 expect(useStore.getState().S.backoffRepsMode).toBe('increased')
})
