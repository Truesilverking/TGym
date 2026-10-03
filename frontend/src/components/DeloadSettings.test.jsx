// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import DeloadSettings from './DeloadSettings.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { bindUI } from './ui.jsx'
import { syncReminder } from '../lib/mobile.js'
vi.mock('../lib/i18n.js', () => ({ t: (key, ...values) => key.replace(/\{(\d+)\}/g, (_, index) => values[index]) }))
vi.mock('../lib/mobile.js', async importOriginal => ({
  ...await importOriginal(), MOBILE: true, nativeSave: vi.fn(async () => true), syncReminder: vi.fn(async () => true),
}))

let root, host, update, toast
const savedConfig = { on: true, normalWeeks: 8, deloadWeeks: 2, loadPct: 85, setPct: 50, targetRir: 4.5, startDate: '2026-01-05', notifications: true }
function Harness() {
  const S = useStore(s => s.S)
  return <DeloadSettings S={S} update={update} toast={toast} />
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-03T12:00:00'))
  vi.clearAllMocks()
  localStorage.clear()
  bindUI(useUI)
  useUI.setState({ settingsDeloadExpanded: false, settingsDeloadDateDraft: undefined, sheets: [] })
  useStore.setState({ user: null, S: { ...structuredClone(DEF), deload: { ...savedConfig }, routines: [{ id: 'r', name: 'Routine' }], workouts: [{ id: 'history', deload: true }] } })
  update = vi.fn(edit => useStore.getState().update(edit))
  toast = vi.fn()
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  act(() => root.render(<Harness />))
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})
const toggle = () => host.querySelector('.deload-settings-toggle')
const panel = () => host.querySelector('.deload-settings-panel')
const click = node => act(() => node.click())
const date = value => act(() => {
  const input = host.querySelector('input[type=date]')
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
})

it('starts compact with real configured values and expanding never writes training data', () => {
  const before = structuredClone(useStore.getState().S)
  expect(toggle().getAttribute('aria-expanded')).toBe('false')
  expect(panel().hidden).toBe(true)
  expect(toggle().textContent).toContain('8 normal weeks + 2 deload week')
  expect(toggle().textContent).toContain('Training load: 85%')
  expect(toggle().textContent).toContain('Working sets: 50%')
  expect(toggle().textContent).toContain('Target RIR: 4.5')
  click(toggle()); click(toggle()); click(toggle())
  expect(panel().hidden).toBe(false)
  expect(update).not.toHaveBeenCalled()
  expect(syncReminder).not.toHaveBeenCalled()
  expect(useStore.getState().S).toEqual(before)
  expect(localStorage.getItem('gym_state_v1')).toBeNull()
})

it('keeps expansion during navigation without persisting it and separates activation from expansion', () => {
  click(toggle())
  act(() => root.render(<div>Other screen</div>))
  act(() => root.render(<Harness />))
  expect(panel().hidden).toBe(false)
  click(host.querySelector('[role=switch][aria-label="Scheduled deload"]'))
  expect(toggle().getAttribute('aria-expanded')).toBe('true')
  expect(useStore.getState().S.deload).toEqual({ ...savedConfig, on: false })
  click(toggle())
  expect(useStore.getState().S.deload.on).toBe(false)
  click(host.querySelector('[role=switch][aria-label="Scheduled deload"]'))
  expect(toggle().getAttribute('aria-expanded')).toBe('false')
  expect(useStore.getState().S.deload).toEqual(savedConfig)
  expect(JSON.parse(localStorage.getItem('gym_state_v1')).settingsDeloadExpanded).toBeUndefined()
})

it('retains valid edits through collapse, navigation and the persisted profile without modifying history', () => {
  click(toggle())
  date('2026-10-12')
  click(toggle()); click(toggle())
  expect(host.querySelector('input[type=date]').value).toBe('2026-10-12')
  act(() => root.render(<div>Other screen</div>))
  act(() => root.render(<Harness />))
  const stored = JSON.parse(localStorage.getItem('gym_state_v1'))
  expect(stored.deload).toEqual({ ...savedConfig, startDate: '2026-10-12' })
  expect(stored.workouts).toEqual([{ id: 'history', deload: true }])
  act(() => useStore.setState({ S: stored }))
  expect(host.querySelector('input[type=date]').value).toBe('2026-10-12')
})

it('keeps an invalid date draft and visible error when collapsed, without replacing saved configuration', () => {
  click(toggle()); date(''); click(toggle())
  expect(panel().hidden).toBe(true)
  expect(host.querySelector('[role=alert]').textContent).toContain('Choose a valid cycle start date.')
  expect(useStore.getState().S.deload).toEqual(savedConfig)
  expect(update).not.toHaveBeenCalled()
  act(() => root.render(<div>Other screen</div>))
  act(() => root.render(<Harness />))
  expect(host.querySelector('[role=alert]')).not.toBeNull()
  click(host.querySelector('.deload-settings-error button'))
  expect(panel().hidden).toBe(false)
  expect(host.querySelector('input[type=date]').value).toBe('')
  date('2026-10-19')
  expect(host.querySelector('[role=alert]')).toBeNull()
  expect(useStore.getState().S.deload.startDate).toBe('2026-10-19')
})

it('reports save failures outside the collapsed section and keeps the saved deload untouched', () => {
  update.mockImplementation(() => { throw new Error('Quota exceeded') })
  click(host.querySelector('[role=switch]'))
  expect(panel().hidden).toBe(true)
  expect(host.querySelector('[role=alert]').textContent).toContain('Could not save changes.')
  expect(useStore.getState().S.deload).toEqual(savedConfig)
})

it('saves alert preference before scheduling and ignores a concurrent duplicate toggle', async () => {
  click(toggle())
  let finish
  syncReminder.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const alerts = [...host.querySelectorAll('[role=switch]')].find(node => node.getAttribute('aria-label') !== 'Scheduled deload')
  act(() => { alerts.click(); alerts.click() })
  expect(update).toHaveBeenCalledTimes(1)
  expect(syncReminder).toHaveBeenCalledTimes(1)
  expect(syncReminder).toHaveBeenCalledWith(expect.objectContaining({ deload: expect.objectContaining({ notifications: false }) }), false, 'deload')
  expect(useStore.getState().S.deload.notifications).toBe(false)
  await act(async () => finish(true))
  expect(alerts.disabled).toBe(false)
  syncReminder.mockResolvedValue(false)
  await act(async () => alerts.click())
  expect(useStore.getState().S.deload.notifications).toBe(true)
  expect(toast).not.toHaveBeenCalled()
})

it('uses the shared deload defaults without writing them when opened', () => {
  act(() => useStore.setState({ S: { ...useStore.getState().S, deload: { on: true } } }))
  expect(toggle().textContent).toContain('Target RIR: 4')
  click(toggle())
  expect(useStore.getState().S.deload).toEqual({ on: true })
  expect(update).not.toHaveBeenCalled()
})
