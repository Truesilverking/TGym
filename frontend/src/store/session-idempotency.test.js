// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useStore, DEF } from './useStore.js'
import { useUI } from './useUI.js'
import { bindUI } from '../components/ui.jsx'
import { doFinishWorkout } from '../sheets.jsx'
import { playAppSound } from '../lib/sound.js'
import { upsertBodyRecord } from '../lib/body-records.js'
import { createBackup, readBackup } from '../lib/backup.js'

vi.mock('../lib/sound.js', () => ({ playAppSound: vi.fn(), vibrate: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: vi.fn(async () => ({})), setRemoteAuth: vi.fn() }))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-03T12:00:00'))
  vi.clearAllMocks()
  localStorage.clear()
  useStore.setState({ S: structuredClone(DEF), user: null })
  useUI.setState({ timer: null, work: null, sheets: [] })
  bindUI(useUI)
})
afterEach(() => {
  useUI.getState().stopRest()
  useUI.getState().stopWork()
  vi.clearAllTimers()
  vi.useRealTimers()
})

it('finishing twice and retrying after reopening adds only one history record and completion signal', async () => {
  useStore.getState().update(s => {
    s.active = {
      id: 'single-session', d: '2026-10-03', start: Date.now() - 60000,
      sessionOrigin: { type: 'planned', routineId: 'routine' }, routineId: 'routine',
      entries: [{ id: '0025', sets: [{ done: true, doneAt: Date.now(), r: 8, w: 20 }] }],
    }
  })
  doFinishWorkout({ silent: true })
  doFinishWorkout({ silent: true })
  await useStore.getState().flushPersistence()
  const saved = JSON.parse(localStorage.getItem('gym_state_v1'))
  useStore.getState().replaceState(saved, false)
  doFinishWorkout({ silent: true })

  expect(saved.active).toBeNull()
  expect(useStore.getState().S.workouts).toHaveLength(1)
  expect(useStore.getState().S.workouts[0]).toMatchObject({
    id: 'single-session', sessionOrigin: { type: 'planned', routineId: 'routine' },
  })
  expect(playAppSound.mock.calls.filter(([, event]) => event === 'completion')).toHaveLength(1)
  expect(readBackup(createBackup(useStore.getState().S)).workouts).toHaveLength(1)
})

it('measurement retry uses its identity while equal measurements with distinct IDs remain legitimate', () => {
  const reading = { id: 'reading', d: '2026-10-03', waist: 80 }
  for (let retry = 0; retry < 2; retry++) {
    useStore.getState().update(s => { s.measurements = upsertBodyRecord(s.measurements, reading) })
  }
  useStore.getState().update(s => {
    s.measurements = upsertBodyRecord(s.measurements, { ...reading, id: 'second-reading' })
  })
  const saved = JSON.parse(localStorage.getItem('gym_state_v1'))
  expect(saved.measurements.map(row => row.id)).toEqual(['reading', 'second-reading'])
  expect(readBackup(createBackup(saved)).measurements).toHaveLength(2)
})
