// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useStore, DEF } from './useStore.js'
import { api } from '../lib/api.js'

vi.mock('../lib/api.js', () => ({ api: vi.fn(), setRemoteAuth: vi.fn() }))

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
