// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { bindUI } from './ui.jsx'
import { doFinishWorkout } from '../sheets.jsx'
import { playAppSound } from '../lib/sound.js'
import { trainingStreak } from '../lib/training-plan.js'

vi.mock('../lib/sound.js', () => ({ playAppSound: vi.fn(), vibrate: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: vi.fn(async () => ({})), setRemoteAuth: vi.fn() }))
vi.mock('../lib/web-state.js', () => ({ loadWebState: async () => null, saveWebState: async () => true }))
vi.mock('../lib/i18n.js', async original => ({ ...await original(), t: (key, ...values) => key.replace(/\{(\d+)\}/g, (_, index) => values[index]) }))

const start = '2026-01-01'
const dateAt = offset => {
  const date = new Date(start + 'T12:00:00')
  date.setDate(date.getDate() + offset)
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}
const nowAt = offset => new Date(dateAt(offset) + 'T12:00:00')
const workout = (id, offset) => ({
  id, d: dateAt(offset), name: 'Synthetic extra', routineId: null,
  sessionOrigin: { type: 'extra', routineId: null },
  start: new Date(dateAt(offset) + 'T10:00:00').getTime(), end: new Date(dateAt(offset) + 'T10:01:00').getTime(),
  entries: [{ id: '0025', target: { mode: 'reps', sets: 1, reps: 8, weight: 40 }, sets: [{ done: true, r: 8, w: 40 }] }],
})
const active = (id, offset) => ({
  ...workout(id, offset), start: Date.now() - 60000, end: undefined,
  lastUserInteractionAt: Date.now(), unit: 'kg', cur: 0,
})
function Sheets() {
  return useUI(state => state.sheets).map(sheet => <div key={sheet.id}>{sheet.render(() => useUI.getState().closeSheet(sheet.id))}</div>)
}
let host, root
const state = () => useStore.getState().S
const ledger = () => state().streakMilestoneLedger
const number = () => host.querySelector('.workout-summary-streak-value')?.textContent
const celebration = () => host.querySelector('.streak-milestone-celebration')
const persisted = () => JSON.parse(localStorage.getItem('gym_state_v1'))
const mount = () => act(() => root.render(<MemoryRouter><Sheets /></MemoryRouter>))
const finish = () => act(() => doFinishWorkout())
const closeAll = () => act(() => useUI.getState().closeAll())
function prepare(previous, patch = {}) {
  vi.setSystemTime(nowAt(previous))
  act(() => useStore.getState().replaceState({
    ...structuredClone(DEF), lang: 'en', trainingStartDate: start, hasCompletedOnboarding: true, hasCompletedAppTour: true,
    sound: false, vibration: false, routines: [], week: {}, dayPlan: {},
    workouts: Array.from({ length: previous }, (_, index) => workout('prior-' + index, index)),
    active: active('finish-' + previous, previous), ...patch,
  }))
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers(); vi.setSystemTime(nowAt(13))
  localStorage.clear(); sessionStorage.clear(); vi.clearAllMocks()
  useStore.setState({ S: structuredClone(DEF), user: null, storageWarning: null })
  useUI.setState({ sheets: [], timer: null, work: null }); bindUI(useUI)
  host = document.createElement('div'); document.body.append(host); root = createRoot(host); mount()
})
afterEach(() => {
  act(() => root.unmount()); host.remove()
  useUI.getState().stopRest(); useUI.getState().stopWork(); useUI.getState().closeAll()
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks()
})

it.each([
  { previous: 13, count: 14, weeks: 2, consumed: 14, next: 4 },
  { previous: 27, count: 28, weeks: 4, consumed: 28, next: 8 },
  { previous: 86, count: 87, weeks: 8, consumed: 56, next: 16 },
])('saves and presents only the highest pending $weeks-week claim in the Finish transaction', ({ previous, count, weeks, consumed, next }) => {
  prepare(previous, { streakCelebrations: [7, 14, 30, 50] })
  expect(trainingStreak(state()).current).toBe(previous); expect(celebration()).toBeNull()
  const snapshots = [], originalWrite = localStorage.setItem.bind(localStorage)
  vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
    if (key === 'gym_state_v1') snapshots.push({ state: JSON.parse(value), summaryAlreadyOpen: !!number() })
    return originalWrite(key, value)
  })
  finish()
  expect(snapshots).toHaveLength(1)
  expect(snapshots[0].summaryAlreadyOpen).toBe(false)
  expect(snapshots[0].state.active).toBeNull()
  expect(snapshots[0].state.workouts.at(-1).id).toBe('finish-' + previous)
  expect(snapshots[0].state.streakMilestoneLedger.episodes).toHaveLength(1)
  expect(snapshots[0].state.streakMilestoneLedger.episodes[0]).toMatchObject({ consumedThrough: consumed, observedCount: count })
  expect(persisted().streakMilestoneLedger).toEqual(ledger())
  expect(state().streakCelebrations).toEqual([7, 14, 30, 50])
  expect(number()).toBe(String(count))
  expect(host.querySelectorAll('.streak-milestone-celebration')).toHaveLength(1)
  expect(celebration().textContent).toContain(weeks + ' weeks of consistency!')
  expect(celebration().textContent).toContain('Next milestone: ' + next + ' weeks')
})

it('advances the same real streak episode from two weeks to four without replaying the lower claim', () => {
  prepare(13); finish()
  const episodeId = ledger().episodes[0].id
  closeAll(); vi.setSystemTime(nowAt(27))
  act(() => useStore.getState().update(s => {
    s.workouts.push(...Array.from({ length: 13 }, (_, index) => workout('continued-' + index, 14 + index)))
    s.active = active('continued-fourth-week', 27)
  }))
  expect(trainingStreak(state()).current).toBe(27)
  finish()
  expect(number()).toBe('28')
  expect(ledger().episodes).toHaveLength(1)
  expect(ledger().episodes[0]).toMatchObject({ id: episodeId, consumedThrough: 28, observedCount: 28 })
  expect(celebration().textContent).toContain('4 weeks of consistency!')
  expect(celebration().textContent).not.toContain('2 weeks of consistency!')
})

it('dismisses the milestone independently of the ordinary saved-workout summary', () => {
  prepare(13); finish()
  const saved = structuredClone(state()), sheetId = useUI.getState().sheets.at(-1).id
  act(() => host.querySelector('[aria-label="Close celebration"]').click())
  expect(celebration()).toBeNull(); expect(number()).toBe('14')
  expect(host.textContent).toContain('Workout complete!'); expect(host.textContent).toContain('Duration')
  expect(host.querySelector('.workout-summary-streak.active .streak-flame-fill').getAttribute('opacity')).toBe('1')
  expect(useUI.getState().sheets.at(-1).id).toBe(sheetId)
  expect(state()).toEqual(saved); expect(persisted().streakMilestoneLedger).toEqual(saved.streakMilestoneLedger)
})

it('does not replay a captured sheet renderer after it is remounted', () => {
  prepare(13); finish(); expect(celebration()).not.toBeNull()
  const capturedSheet = useUI.getState().sheets.at(-1), savedLedger = structuredClone(ledger())
  closeAll()
  act(() => useUI.getState().openSheet(capturedSheet.render, { kind: capturedSheet.kind, locked: capturedSheet.locked }))
  expect(number()).toBe('14'); expect(celebration()).toBeNull()
  expect(ledger()).toEqual(savedLedger); expect(persisted().workouts).toHaveLength(14)
})

it('keeps the offline claim across local snapshot rehydration, duplicate-ID saves and another session on the same date', () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  prepare(13); finish()
  const serialized = localStorage.getItem('gym_state_v1'), savedLedger = structuredClone(ledger())
  closeAll(); act(() => root.unmount()); root = createRoot(host)
  act(() => useStore.setState({ S: structuredClone(DEF), user: null }))
  act(() => useStore.getState().replaceState(JSON.parse(serialized))); mount()
  expect(number()).toBeUndefined(); expect(celebration()).toBeNull(); expect(ledger()).toEqual(savedLedger)
  act(() => useStore.getState().update(s => { s.active = active('finish-13', 13) }))
  finish()
  expect(state().workouts).toHaveLength(14); expect(useUI.getState().sheets).toHaveLength(0)
  act(() => useStore.getState().update(s => { s.active = active('same-date-extra', 13) }))
  finish()
  expect(state().workouts).toHaveLength(15); expect(number()).toBe('14'); expect(celebration()).toBeNull()
  expect(ledger().episodes).toHaveLength(1); expect(ledger().episodes[0].consumedThrough).toBe(14)
  expect(persisted().streakMilestoneLedger).toEqual(ledger())
  expect(playAppSound.mock.calls.filter(([, event]) => event === 'completion')).toHaveLength(2)
})

it.each(['delete-history', 'remove-confirmed-activity'])('invalidates an open claim on %s and never revives it when history is restored', kind => {
  prepare(13); finish()
  const originalHistory = structuredClone(state().workouts), claimedLedger = structuredClone(ledger())
  act(() => useStore.getState().update(s => {
    if (kind === 'delete-history') s.workouts = []
    else { const row = s.workouts.find(w => w.id === 'finish-13').entries[0].sets[0]; row.done = false; row.r = 0 }
  }))
  const current = kind === 'delete-history' ? 0 : 13
  expect(number()).toBe(String(current)); expect(celebration()).toBeNull()
  expect(host.querySelector('.workout-summary-streak .streak-flame').classList.contains(current ? 'active' : 'inactive')).toBe(true)
  expect(host.querySelector('.workout-summary-streak .streak-flame-fill').getAttribute('opacity')).toBe(current ? '1' : '0')
  expect(ledger()).toEqual(claimedLedger)
  act(() => useStore.getState().update(s => { s.workouts = originalHistory }))
  expect(number()).toBe('14'); expect(celebration()).toBeNull()
  expect(host.querySelector('.workout-summary-streak.streak-redgold')).not.toBeNull()
  closeAll(); vi.setSystemTime(nowAt(14))
  act(() => useStore.getState().update(s => { s.active = active('after-history-restoration', 14) }))
  finish()
  expect(number()).toBe('15'); expect(celebration()).toBeNull()
  expect(ledger().episodes).toHaveLength(1); expect(ledger().episodes[0].consumedThrough).toBe(14)
})

it('celebrates the same threshold again only after a new real streak following a missed scheduled date', () => {
  const routines = [{ id: 'synthetic-daily', name: 'Synthetic daily', ex: [] }]
  const week = Object.fromEntries(Array.from({ length: 7 }, (_, index) => [index, ['synthetic-daily']]))
  prepare(13, { routines, week }); finish()
  const firstEpisode = ledger().episodes[0].id
  expect(celebration().textContent).toContain('2 weeks of consistency!')
  closeAll(); vi.setSystemTime(nowAt(28))
  act(() => useStore.getState().update(s => {
    // Date 14 has a scheduled routine and deliberately has no valid activity.
    s.workouts.push(...Array.from({ length: 13 }, (_, index) => workout('new-run-' + index, 15 + index)))
    s.active = active('new-run-fourteenth', 28)
  }))
  expect(trainingStreak(state()).rows.find(row => row.iso === dateAt(14)).status).toBe('missed')
  expect(trainingStreak(state()).current).toBe(13)
  finish()
  expect(number()).toBe('14'); expect(celebration().textContent).toContain('2 weeks of consistency!')
  expect(ledger().episodes).toHaveLength(2)
  const secondEpisode = ledger().episodes.find(episode => episode.id !== firstEpisode)
  expect(secondEpisode).toMatchObject({ consumedThrough: 14, observedCount: 14 })
  expect(persisted().streakMilestoneLedger).toEqual(ledger())
})

it('does not consume or present a milestone when primary persistence fails, and can claim it on a successful retry', () => {
  prepare(13)
  const before = structuredClone(state()), serialized = localStorage.getItem('gym_state_v1')
  const originalWrite = localStorage.setItem.bind(localStorage)
  const write = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
    if (key === 'gym_state_v1') throw new DOMException('Storage full', 'QuotaExceededError')
    return originalWrite(key, value)
  })
  expect(() => finish()).toThrow('Storage full')
  expect(state()).toEqual(before); expect(localStorage.getItem('gym_state_v1')).toBe(serialized)
  expect(state().active.id).toBe('finish-13'); expect(state().workouts).toHaveLength(13)
  expect(useStore.getState().storageWarning).toBe('primary')
  expect(useUI.getState().sheets).toHaveLength(0); expect(number()).toBeUndefined(); expect(celebration()).toBeNull()
  expect(playAppSound).not.toHaveBeenCalled()
  write.mockRestore(); finish()
  expect(state().active).toBeNull(); expect(state().workouts).toHaveLength(14)
  expect(useStore.getState().storageWarning).toBeNull()
  expect(ledger().episodes[0].consumedThrough).toBe(14); expect(celebration()).not.toBeNull()
})
