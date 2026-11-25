// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Settings from './Settings.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { bindUI } from '../components/ui.jsx'

const native = vi.hoisted(() => ({ sync: vi.fn(), save: vi.fn(), listeners: new Set(), status: {} }))
vi.mock('../lib/mobile.js', async original => ({
  ...await original(), MOBILE: true, nativeSave: native.save, syncReminder: native.sync,
  getReminderStatus: () => native.status,
  subscribeReminderStatus: listener => { native.listeners.add(listener); return () => native.listeners.delete(listener) },
}))
vi.mock('../lib/i18n.js', async original => ({
  ...await original(), t: (key, ...values) => key.replace(/\{(\d+)\}/g, (_, index) => values[index]),
}))
vi.mock('../components/AppUpdate.jsx', () => ({ UpdateCheckButton: () => null }))

let host, root
const measurement = { time: '08:15', notifications: false, items: { weight: { id: 'measurement:weight', enabled: true, anchorDate: '2026-10-03', intervalUnit: 'weeks', intervalValue: 2 } } }
const workout = { ...DEF.reminder, on: false, time: '09:20', nextTime: '19:00', dayTimes: { 1: '10:00' } }
function HomeLink() {
  const navigate = useNavigate()
  return <button onClick={() => navigate('/settings')}>Back to Settings</button>
}
function App() {
  return <MemoryRouter initialEntries={['/settings']}><Routes>
    <Route path="/settings" element={<Settings />} />
    <Route path="/home" element={<HomeLink />} />
  </Routes></MemoryRouter>
}
async function mount() { await act(async () => root.render(<App />)) }
async function click(node) { expect(node).toBeTruthy(); await act(async () => node.click()) }
async function input(node, value) {
  expect(node).toBeTruthy()
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(node, value)
    node.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const section = title => [...host.querySelectorAll('section.sect')].find(node => node.querySelector(':scope > h2')?.textContent === title)
const panel = title => [...host.querySelectorAll('.reminder-panel')].find(node => node.querySelector('h3')?.textContent === title)
const workoutToggle = () => panel('Workout day reminder').querySelector('.reminder-heading [role=switch]')
const weightToggle = () => panel('Measurement reminders').querySelector('.reminder-metric-toggle [role=switch]')
const measurementToggle = () => panel('Measurement reminders').querySelector('.lrow [role=switch]')
const firstData = () => section('Data').querySelector('.sect-b').firstElementChild
function assertDataOrder() {
  expect(firstData().querySelector('.lrow-t').textContent).toBe('All Data stays on this device')
  expect(firstData().nextElementSibling.querySelector('.lrow-t').textContent).toBe('Training history settings')
  expect([...host.querySelectorAll('h2')].some(node => node.textContent === 'Your Data')).toBe(false)
}

beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-03T12:00:00'))
  vi.clearAllMocks()
  localStorage.clear(); sessionStorage.clear()
  native.sync.mockResolvedValue(true); native.save.mockResolvedValue(true)
  native.status = Object.fromEntries(['measurement', 'workout', 'deload'].map(kind => [kind, { status: 'configured', count: 1, nextAt: '2026-10-05T10:00:00Z' }]))
  useStore.setState({ user: null, storageWarning: null, S: {
    ...structuredClone(DEF), lang: 'en', hasCompletedOnboarding: true,
    measurementReminders: structuredClone(measurement), reminder: structuredClone(workout),
    routines: [{ id: 'routine', name: 'Routine', ex: [] }], week: { 1: ['routine'], 3: ['routine'] },
  } })
  useUI.setState({ sheets: [], settingsDeloadExpanded: false, settingsDeloadDateDraft: undefined })
  bindUI(useUI)
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await mount()
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks()
})

it('keeps the privacy row first during preference changes, navigation, persisted reopen and remount', async () => {
  assertDataOrder()
  expect(native.sync).not.toHaveBeenCalled()
  await click([...section('Appearance').querySelectorAll('button')].find(node => node.textContent === 'Light'))
  assertDataOrder()
  await click(host.querySelector('[aria-label="Home"]'))
  await click([...host.querySelectorAll('button')].find(node => node.textContent === 'Back to Settings'))
  assertDataOrder()
  const saved = JSON.parse(localStorage.getItem('gym_state_v1'))
  await act(async () => { root.unmount(); useStore.setState({ S: saved }); root = createRoot(host) })
  await mount()
  assertDataOrder()
  expect(useStore.getState().S.theme).toBe('light')
  expect(native.sync).not.toHaveBeenCalled()
})

it('removes the report selector from Data and preserves Backup and Restore without changing the profile',async()=>{
 const before=JSON.stringify(useStore.getState().S)
 const rows=[...section('Data').querySelectorAll('button')].filter(b=>b.querySelector('.lrow-t')?.textContent==='Export Reports')
 expect(rows).toHaveLength(0)
 expect(host.querySelector('[aria-label="Export Reports"]')).toBeNull()
 const backup=[...section('Data').querySelectorAll('button')].filter(b=>b.querySelector('.lrow-t')?.textContent==='Backup')
 const restore=[...section('Data').querySelectorAll('button')].filter(b=>b.querySelector('.lrow-t')?.textContent==='Restore')
 expect(backup).toHaveLength(1);expect(restore).toHaveLength(1)
 await click(backup[0]);expect(useUI.getState().sheets).toHaveLength(1)
 const sheet=document.createElement('div'),sheetRoot=createRoot(sheet)
 await act(async()=>sheetRoot.render(useUI.getState().sheets[0].render(()=>{})))
 expect(sheet.querySelector('h3').textContent).toBe('Backup')
 expect(sheet.textContent).toContain('Export full backup');expect(sheet.textContent).toContain('Import full backup')
 expect(sheet.querySelector('.reports-export')).toBeNull()
 expect(JSON.stringify(useStore.getState().S)).toBe(before)
 await act(async()=>sheetRoot.unmount());useUI.getState().closeAll()
 await click(restore[0]);expect(useUI.getState().sheets).toHaveLength(1)
 const restoreDialog=useUI.getState().sheets[0].render(()=>{})
 expect(restoreDialog.type.name).toBe('RestoreSheet')
 expect(restoreDialog.props.authorize).toBeTypeOf('function')
 expect(JSON.stringify(useStore.getState().S)).toBe(before)
 expect(native.save).not.toHaveBeenCalled();expect(native.sync).not.toHaveBeenCalled()
 useUI.getState().closeAll()
})

it('explains actual external transfers for local and server-connected profiles without moving Data content', async () => {
  expect(firstData().textContent).toContain('Connecting a server, enabling cloud backup or sharing an export sends a copy outside this device.')
  await act(async () => useStore.setState({ user: { id: 'paired-user', name: 'Synthetic profile' } }))
  assertDataOrder()
  expect(firstData().textContent).toContain('This profile also syncs with your connected server.')
  expect(firstData().textContent).toContain('Cloud backups and exported copies leave this device when you choose them.')
})

it('edits and toggles each reminder independently and restores retained configuration after reopening', async () => {
  await click(workoutToggle())
  expect(useStore.getState().S.measurementReminders).toEqual(measurement)
  const workoutTime = [...panel('Workout day reminder').querySelectorAll('input[type=time]')][0]
  await input(workoutTime, '11:40')
  await click(workoutToggle())
  expect(useStore.getState().S.reminder).toMatchObject({ on: false, time: '11:40', dayTimes: { 1: '10:00' } })
  const storedWorkout = structuredClone(useStore.getState().S.reminder)
  const frequency = panel('Measurement reminders').querySelector('select')
  await act(async () => { frequency.value = 'month'; frequency.dispatchEvent(new Event('change', { bubbles: true })) })
  await input(panel('Measurement reminders').querySelector('input[type=time]'), '07:45')
  await click(measurementToggle())
  await click(weightToggle())
  expect(useStore.getState().S.measurementReminders.items.weight).toMatchObject({ enabled: false, intervalUnit: 'months', intervalValue: 1 })
  await click(weightToggle())
  await click(measurementToggle())
  expect(useStore.getState().S.measurementReminders).toMatchObject({ notifications: false, time: '07:45', items: { weight: { enabled: true, intervalUnit: 'months', intervalValue: 1 } } })
  expect(useStore.getState().S.reminder).toEqual(storedWorkout)
  const saved = JSON.parse(localStorage.getItem('gym_state_v1'))
  await act(async () => { root.unmount(); useStore.setState({ S: saved }); root = createRoot(host) })
  await mount()
  expect(panel('Measurement reminders').querySelector('input[type=time]').value).toBe('07:45')
  expect(panel('Measurement reminders').querySelector('select').value).toBe('month')
  expect(weightToggle().getAttribute('aria-checked')).toBe('true')
  expect(measurementToggle().getAttribute('aria-checked')).toBe('false')
  expect(workoutToggle().getAttribute('aria-checked')).toBe('false')
  expect([...panel('Workout day reminder').querySelectorAll('input[type=time]')][0].value).toBe('11:40')
  const callsBeforeReactivate = native.sync.mock.calls.length
  await click(workoutToggle()); await click(measurementToggle())
  expect(native.sync.mock.calls.length).toBe(callsBeforeReactivate + 2)
  expect(useStore.getState().S.reminder.time).toBe('11:40')
  expect(useStore.getState().S.measurementReminders.time).toBe('07:45')
})

it('guards a rapid repeated enable while native scheduling is pending', async () => {
  let finish
  native.sync.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  await act(async () => { workoutToggle().click(); workoutToggle().click() })
  expect(useStore.getState().S.reminder.on).toBe(true)
  expect(native.sync).toHaveBeenCalledOnce()
  expect(workoutToggle().disabled).toBe(true)
  await act(async () => finish(true))
  expect(workoutToggle().disabled).toBe(false)
})

it('retains the last rapid time edit and another reminder frequency while scheduling is pending', async () => {
  const finishes = []
  native.sync.mockImplementation(() => new Promise(resolve => finishes.push(resolve)))
  const time = panel('Workout day reminder').querySelector('input[type=time]')
  await act(async () => {
    for (const value of ['11:30', '12:45', '13:15']) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(time, value)
      time.dispatchEvent(new Event('input', { bubbles: true }))
    }
    const frequency = panel('Measurement reminders').querySelector('select')
    frequency.value = 'month'
    frequency.dispatchEvent(new Event('change', { bubbles: true }))
  })
  expect(useStore.getState().S.reminder).toMatchObject({ on: false, time: '13:15' })
  expect(useStore.getState().S.measurementReminders.items.weight).toMatchObject({ enabled: true, intervalUnit: 'months', intervalValue: 1 })
  expect(native.sync).toHaveBeenCalledTimes(4)
  const saved = JSON.parse(localStorage.getItem('gym_state_v1'))
  expect(saved.reminder.time).toBe('13:15')
  await act(async () => finishes.forEach(resolve => resolve(true)))
  expect(time.value).toBe('13:15')
  expect(panel('Measurement reminders').querySelector('select').value).toBe('month')
})

it.each(['permission-denied', 'error'])('shows %s feedback instead of claiming a functioning reminder', async status => {
  native.status = { ...native.status, workout: { status, count: 0, nextAt: null } }
  await act(async () => { useStore.setState({ S: { ...useStore.getState().S, reminder: { ...workout, on: true } } }); native.listeners.forEach(listener => listener()) })
  const message = panel('Workout day reminder').querySelector('[role=alert]')
  expect(message.textContent).toContain(status === 'permission-denied' ? 'Enable notifications in your device settings.' : 'Could not schedule notifications. Try again.')
  expect(message.textContent).toContain('Retry')
  expect(panel('Workout day reminder').textContent).not.toContain('Next notification:')
  expect(native.sync).not.toHaveBeenCalled()
})

it('reports a failed preference save and leaves the stored reminder disabled', async () => {
  const write = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded') })
  await click(workoutToggle())
  expect(useStore.getState().S.reminder).toEqual(workout)
  expect(panel('Workout day reminder').querySelector('[role=alert]').textContent).toContain('Could not save changes.')
  expect(native.sync).not.toHaveBeenCalled()
  write.mockRestore()
})

it('keeps a cancellation failure visible even when the saved preference is off', async () => {
  native.status = { ...native.status, workout: {status:'error',count:0,nextAt:null} }
  await act(async () => native.listeners.forEach(listener=>listener()))
  expect(workoutToggle().getAttribute('aria-checked')).toBe('false')
  expect(panel('Workout day reminder').querySelector('[role=alert]').textContent).toContain('Could not schedule notifications. Try again.')
  expect(panel('Workout day reminder').querySelector('[role=alert]').textContent).toContain('Retry')
})
