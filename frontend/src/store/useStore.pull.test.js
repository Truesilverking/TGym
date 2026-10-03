// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useStore, DEF } from './useStore.js'
import { api } from '../lib/api.js'
import { convertMeasurementState, convertWeightState } from '../lib/unit-conversion.js'

vi.mock('../lib/api.js', () => ({ api: vi.fn(), setRemoteAuth: vi.fn() }))
vi.mock('../lib/remote.js', () => ({ loadRemote: async () => null, connect: vi.fn(async () => ({ id: 'paired-account' })), chooseLocal: vi.fn(), forgetRemote: vi.fn() }))

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  localStorage.clear()
  useStore.setState({ S: structuredClone(DEF), user: null })
  useStore.getState().setUser({ id: 'first-account' })
})
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })

function pendingPull() {
  let resolveRead
  api.mockImplementation((path, options) => options?.method === 'PUT'
    ? Promise.resolve({})
    : new Promise(resolve => { resolveRead = resolve }))
  const pulling = useStore.getState().pullState()
  return { pulling, respond: state => resolveRead({ state }) }
}

it.each([true, false])('keeps preference edits made during a pending read (sync intent %s)', async push => {
  const { pulling, respond } = pendingPull()
  useStore.getState().update(s => {
    s.unit = 'lb'
    s.deload.loadPct = 72
  }, push)
  // A future remote timestamp must not win over a change made after this read began.
  respond({ ...structuredClone(DEF), _ts: Date.now() + 1000 })
  await pulling

  expect(useStore.getState().S).toMatchObject({ unit: 'lb', deload: { loadPct: 72 } })
  expect(JSON.parse(localStorage.getItem('gym_state_v1')).unit).toBe('lb')
  expect(api.mock.calls.map(([, options]) => options?.method || 'GET')).toEqual(['GET', 'PUT'])
  expect(JSON.parse(api.mock.calls[1][1].body).state.deload.loadPct).toBe(72)
})

it('keeps unsent preferences made before a pull even without training records', async () => {
  useStore.getState().update(s => { s.unit = 'lb' })
  const { pulling, respond } = pendingPull()
  respond({ ...structuredClone(DEF), _ts: Date.now() + 1000 })
  await pulling
  expect(useStore.getState().S.unit).toBe('lb')
  expect(JSON.parse(api.mock.calls[1][1].body).state.unit).toBe('lb')
})

it('restores existing cloud history after sign-out left a newer clean empty local snapshot', async () => {
  // clearLocalSession persists DEF with a new timestamp after a successful sign-out.
  useStore.getState().replaceState(structuredClone(DEF), false)
  const { pulling, respond } = pendingPull()
  respond({ ...structuredClone(DEF), _ts: 1, unit: 'lb', workouts: [{ id: 'cloud-history', entries: [] }] })
  await pulling
  expect(useStore.getState().S.unit).toBe('lb')
  expect(useStore.getState().S.workouts[0].id).toBe('cloud-history')
  expect(api).toHaveBeenCalledOnce()
})

it.each([{ id: 'second-account' }, null])('ignores a response from an account that is no longer current (%j)', async user => {
  const { pulling, respond } = pendingPull()
  useStore.getState().setUser(user)
  const current = useStore.getState().S
  respond({ ...structuredClone(DEF), _ts: Date.now() + 1000, unit: 'lb' })
  await pulling
  expect(useStore.getState().S).toBe(current)
  expect(useStore.getState().user).toEqual(user)
  expect(api).toHaveBeenCalledOnce()
  expect(localStorage.getItem('gym_state_v1')).toBeNull()
})

it('still restores a fresh cloud profile for the same account when no local edit is pending', async () => {
  const { pulling, respond } = pendingPull()
  respond({ ...structuredClone(DEF), _ts: Date.now() + 1000, unit: 'lb' })
  await pulling
  expect(useStore.getState().S.unit).toBe('lb')
  expect(JSON.parse(localStorage.getItem('gym_state_v1')).unit).toBe('lb')
  expect(api).toHaveBeenCalledOnce()
})

it('preserves a local active session while applying a fresh remote profile', async () => {
  const active = { id: 'in-progress', start: Date.now(), entries: [] }
  useStore.setState({ S: { ...structuredClone(DEF), active } })
  const { pulling, respond } = pendingPull()
  respond({ ...structuredClone(DEF), _ts: Date.now() + 1000, unit: 'lb', active: null })
  await pulling
  expect(useStore.getState().S.active.id).toBe('in-progress')
  expect(useStore.getState().S.unit).toBe('lb')
})

function cloudProfile() {
  return {
    ...structuredClone(DEF), _ts: 1,
    routines: [{ id: 'cloud-routine', name: 'Cloud routine', ex: [{ id: '0025', sets: 1, weight: 5, inc: 2.5 }] }],
    week: { 1: ['cloud-routine'] },
    workouts: [{ id: 'cloud-history', routineId: 'cloud-routine', sessionOrigin: { type: 'planned', routineId: 'cloud-routine' }, d: '2026-09-21', start: 1000, end: 61000, unit: 'kg', vol: 40, entries: [{ id: '0025', target: { weight: 5 }, sets: [{ done: true, r: 8, w: 5 }] }] }],
    bodyweight: [{ d: '2026-09-21', w: 70, samples: [{ id: 'sample', w: 70 }] }],
    measurements: [{ id: 'cloud-measurement', d: '2026-09-21', waist: 80, unit: 'cm' }],
    heightCm: 180,
    deload: { ...DEF.deload, on: true, normalWeeks: 8, loadPct: 85, startDate: '2026-09-01' },
  }
}

it('defers autosave, reconnect, background and manual PUT until the full cloud baseline is rebased', async () => {
  let respond, server = cloudProfile()
  api.mockImplementation((path, options) => {
    if (options?.method === 'PUT') {
      server = JSON.parse(options.body).state
      delete server.active // Match the real whole-profile API replacement contract.
      return Promise.resolve({})
    }
    return new Promise(resolve => { respond = () => resolve({ state: structuredClone(server) }) })
  })
  const pulling = useStore.getState().pullState()
  useStore.getState().update(s => {
    convertWeightState(s, 'lb'); convertMeasurementState(s, 'in')
    s.deload.loadPct = 72
    s.reminder.time = '11:40'
  })
  await vi.advanceTimersByTimeAsync(1600)
  window.dispatchEvent(new Event('online'))
  window.dispatchEvent(new Event('pagehide'))
  const manual = useStore.getState().pushState()
  expect(api.mock.calls.map(([, options]) => options?.method || 'GET')).toEqual(['GET'])
  respond()
  expect(await pulling).toBe(true)
  expect(await manual).toBe(true)
  await vi.waitFor(() => expect(localStorage.getItem('gym_dirty')).toBeNull())

  expect(server.routines[0]).toMatchObject({ id: 'cloud-routine', ex: [{ weight: 11.02, inc: 5.51 }] })
  expect(server.workouts[0]).toMatchObject({ id: 'cloud-history', routineId: 'cloud-routine', unit: 'lb', vol: 88.18, entries: [{ sets: [{ w: 11.02, r: 8 }] }] })
  expect(server.bodyweight[0]).toMatchObject({ w: 154.32, samples: [{ id: 'sample', w: 154.32 }] })
  expect(server.measurements[0]).toMatchObject({ id: 'cloud-measurement', waist: 31.5, unit: 'in' })
  expect(server.heightCm).toBe(70.87)
  expect(server.week).toEqual({ 1: ['cloud-routine'] })
  expect(server.deload).toMatchObject({ on: true, normalWeeks: 8, loadPct: 72, startDate: '2026-09-01' })
  expect(server.reminder.time).toBe('11:40')
  for (const [, options] of api.mock.calls.filter(([, options]) => options?.method === 'PUT')) {
    expect(JSON.parse(options.body).state.workouts[0].id).toBe('cloud-history')
  }
  expect(useStore.getState().serverSyncError).toBeNull()
})

it('keeps a failed initial read fenced and dirty, then reads before a later upload retry', async () => {
  let reply, rejectRead
  let server = cloudProfile()
  api.mockImplementation((path, options) => {
    if (options?.method === 'PUT') { server = JSON.parse(options.body).state; return Promise.resolve({}) }
    return new Promise((resolve, reject) => { reply = () => resolve({ state: structuredClone(server) }); rejectRead = reject })
  })
  const pulling = useStore.getState().pullState()
  useStore.getState().update(s => { s.theme = 'light' })
  const waitingUpload = useStore.getState().pushState()
  rejectRead(new Error('offline'))
  expect(await pulling).toBe(false)
  expect(await waitingUpload).toBe(false)
  expect(useStore.getState().serverSyncError).toBeTruthy()
  expect(localStorage.getItem('gym_dirty')).toBe('1')
  expect(server.workouts[0].id).toBe('cloud-history')
  const retry = useStore.getState().pushState()
  expect(api.mock.calls.map(([, options]) => options?.method || 'GET')).toEqual(['GET', 'GET'])
  rejectRead(new Error('still offline'))
  expect(await retry).toBe(false)
  expect(api.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false)
  const restored = useStore.getState().pushState()
  reply()
  expect(await restored).toBe(true)
  expect(server.workouts[0].id).toBe('cloud-history')
  expect(server.theme).toBe('light')
  expect(useStore.getState().serverSyncError).toBeNull()
})

it('does not lose cloud history when preferences were dirty before the first read', async () => {
  useStore.getState().update(s => { convertWeightState(s, 'lb'); s.deload.loadPct = 72 })
  const { pulling, respond } = pendingPull()
  respond(cloudProfile())
  expect(await pulling).toBe(true)
  const uploaded = JSON.parse(api.mock.calls.find(([, options]) => options?.method === 'PUT')[1].body).state
  expect(uploaded.workouts[0].id).toBe('cloud-history')
  expect(uploaded.workouts[0].entries[0].sets[0].w).toBe(11.02)
  expect(uploaded.deload).toMatchObject({ on: true, normalWeeks: 8, loadPct: 72 })
})

it('normalizes a local active snapshot to cloud units without converting its source twice', async () => {
  const active = { id: 'live', start: Date.now(), unit: 'kg', entries: [{ id: '0025', sets: [{ w: 5, r: 8, done: false }] }] }
  useStore.setState({ S: { ...structuredClone(DEF), active } })
  const remote = cloudProfile(); convertWeightState(remote, 'lb')
  const { pulling, respond } = pendingPull()
  respond(remote)
  expect(await pulling).toBe(true)
  expect(useStore.getState().S.active).toMatchObject({ id: 'live', unit: 'lb', entries: [{ sets: [{ w: 11.02 }] }] })
  expect(active.entries[0].sets[0].w).toBe(5)
  expect(useStore.getState().S.workouts[0].entries[0].sets[0].w).toBe(11.02)
})

it('retains distinct new local and cloud history IDs instead of replacing either copy', async () => {
  const { pulling, respond } = pendingPull()
  useStore.getState().update(s => { s.workouts.push({ id: 'new-local', entries: [] }) })
  respond(cloudProfile())
  expect(await pulling).toBe(true)
  const uploaded = JSON.parse(api.mock.calls.find(([, options]) => options?.method === 'PUT')[1].body).state
  expect(uploaded.workouts.map(row => row.id)).toEqual(['new-local', 'cloud-history'])
})

it('blocks ambiguous initial merge without changing local or server records', async () => {
  const { pulling, respond } = pendingPull()
  useStore.getState().update(s => { s.workouts.push({ entries: [{ id: 'local' }] }) })
  const local = useStore.getState().S
  const remote = cloudProfile()
  respond(remote)
  expect(await pulling).toBe(false)
  expect(useStore.getState().S).toBe(local)
  expect(remote.workouts[0].id).toBe('cloud-history')
  expect(api.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false)
  expect(useStore.getState().serverSyncError).toBeTruthy()
  expect(localStorage.getItem('gym_dirty')).toBe('1')
})

it('discards an account-switched read and its queued empty upload', async () => {
  const { pulling, respond } = pendingPull()
  useStore.getState().update(s => { s.theme = 'light' })
  const uploading = useStore.getState().pushState()
  useStore.getState().setUser({ id: 'other-account' })
  respond(cloudProfile())
  expect(await pulling).toBe(false)
  expect(await uploading).toBe(false)
  expect(api).toHaveBeenCalledOnce()
  expect(useStore.getState().S.workouts).toEqual([])
  expect(useStore.getState().serverSyncError).toBeNull()
})

it('reads the baseline before a cached empty profile can upload from online/background events', async () => {
  let reply, server = cloudProfile()
  api.mockImplementation((path, options) => {
    if (options?.method === 'PUT') { server = JSON.parse(options.body).state; return Promise.resolve({}) }
    return new Promise(resolve => { reply = () => resolve({ state: structuredClone(server) }) })
  })
  useStore.getState().update(s => { s.theme = 'light' })
  // No pullState was called by boot yet.
  window.dispatchEvent(new Event('online'))
  window.dispatchEvent(new Event('pagehide'))
  const manual = useStore.getState().pushState()
  await vi.advanceTimersByTimeAsync(1600)
  expect(api.mock.calls.map(([, options]) => options?.method || 'GET')).toEqual(['GET'])
  reply()
  expect(await manual).toBe(true)
  await vi.waitFor(() => expect(localStorage.getItem('gym_dirty')).toBeNull())
  expect(server.workouts[0].id).toBe('cloud-history')
  expect(server.routines[0].id).toBe('cloud-routine')
  expect(server.theme).toBe('light')
})

it('does not sign out or upload a partial profile when its initial baseline read fails', async () => {
  let fail
  api.mockImplementation(() => new Promise((resolve, reject) => { fail = reject }))
  const pulling = useStore.getState().pullState()
  useStore.getState().update(s => { s.theme = 'light' })
  const signingOut = useStore.getState().signOut()
  fail(new Error('offline'))
  expect(await pulling).toBe(false)
  await expect(signingOut).rejects.toThrow('Your local data was kept')
  expect(useStore.getState().user.id).toBe('first-account')
  expect(useStore.getState().S.theme).toBe('light')
  expect(localStorage.getItem('gym_dirty')).toBe('1')
  expect(api.mock.calls.map(([path]) => path)).toEqual(['/api/data'])
})

it('keeps new-account uploads with actual local training data independent of the empty bootstrap', async () => {
  useStore.getState().update(s => { s.routines.push({ id: 'new-account-routine', ex: [] }) }, false)
  api.mockResolvedValue({})
  expect(await useStore.getState().pushState()).toBe(true)
  expect(api).toHaveBeenCalledOnce()
  expect(api.mock.calls[0][1].method).toBe('PUT')
  expect(JSON.parse(api.mock.calls[0][1].body).state.routines[0].id).toBe('new-account-routine')
})

it('reports failed pairing synchronization instead of completing onboarding', async () => {
  useStore.setState({ needsMobileOnboarding: true })
  api.mockRejectedValue(new Error('offline'))
  await expect(useStore.getState().connectToServer('https://example.test', 'synthetic-code')).rejects.toThrow('Your local data was kept')
  expect(useStore.getState().needsMobileOnboarding).toBe(true)
  expect(useStore.getState().serverSyncError).toBeTruthy()
})
