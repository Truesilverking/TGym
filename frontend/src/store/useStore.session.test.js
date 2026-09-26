// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useStore, DEF } from './useStore.js'
import { api } from '../lib/api.js'

vi.mock('../lib/api.js', () => ({ api: vi.fn(), setRemoteAuth: vi.fn() }))
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); localStorage.clear()
  useStore.setState({ S: structuredClone(DEF), user: null })
  useStore.getState().setUser({ id: 'test-user', name: 'QA' })
  useStore.getState().update(s => { s.workouts = [{ id: 'unsynced', entries: [] }] })
})
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })

it.each(['signOut', 'signOutAll'])('%s keeps unsynced data and the session when saving fails', async action => {
  api.mockImplementation(async path => { if (path === '/api/data') throw new Error('offline'); return {} })
  await expect(useStore.getState()[action]()).rejects.toThrow()
  expect(useStore.getState().user?.id).toBe('test-user')
  expect(JSON.parse(localStorage.getItem('gym_state_v1')).workouts[0].id).toBe('unsynced')
  expect(localStorage.getItem('gym_dirty')).toBe('1')
  expect(api.mock.calls.map(([path]) => path)).toEqual(['/api/data'])
})

it('does not clear local data when the logout request itself fails', async () => {
  api.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('server unavailable'))
  await expect(useStore.getState().signOut()).rejects.toThrow()
  expect(useStore.getState().user?.id).toBe('test-user')
  expect(useStore.getState().S.workouts[0].id).toBe('unsynced')
})

it.each(['signOut', 'signOutAll'])('%s retains edits made while an upload is pending', async action => {
  let finishUpload
  api.mockImplementation(() => new Promise(resolve => { finishUpload = resolve }))
  const signingOut = useStore.getState()[action]()
  await vi.waitFor(() => expect(finishUpload).toBeTypeOf('function'))
  useStore.getState().update(s => { s.workouts.push({ id: 'newer', entries: [] }) }, false)
  finishUpload({})
  await expect(signingOut).rejects.toThrow('Local data changed')
  expect(useStore.getState().S.workouts.map(w => w.id)).toEqual(['unsynced', 'newer'])
  expect(useStore.getState().user?.id).toBe('test-user')
  expect(localStorage.getItem('gym_dirty')).toBe('1')
  expect(api).toHaveBeenCalledOnce()
})

it.each(['signOut', 'signOutAll'])('%s uploads before ending the session and clearing the local copy', async action => {
  api.mockResolvedValue({})
  await useStore.getState()[action]()
  expect(JSON.parse(api.mock.calls[0][1].body).state.workouts[0].id).toBe('unsynced')
  expect(api.mock.calls.map(([path]) => path)).toEqual(['/api/data', action === 'signOut' ? '/api/logout' : '/api/logout/all'])
  expect(useStore.getState().user).toBeNull()
  expect(useStore.getState().S.workouts).toEqual([])
})

it.each(['signOut', 'signOutAll'])('%s retains newer edits if they arrive while the logout response is pending', async action => {
  let finishLogout
  api.mockImplementation(async path => path === '/api/data' ? {} : new Promise(resolve => { finishLogout = resolve }))
  const signingOut = useStore.getState()[action]()
  await vi.waitFor(() => expect(finishLogout).toBeTypeOf('function'))
  useStore.getState().update(s => { s.workouts.push({ id: 'last-edit', entries: [] }) }, false)
  finishLogout({})
  expect(await signingOut).toBe(false) // Auth ended, but newer local data was deliberately retained.
  expect(useStore.getState().user).toBeNull()
  expect(JSON.parse(localStorage.getItem('gym_state_v1')).workouts.map(w => w.id)).toEqual(['unsynced', 'last-edit'])
  expect(localStorage.getItem('gym_dirty')).toBe('1')
})

it.each(['signOut', 'signOutAll'])('%s retains an active workout that the API deliberately does not store', async action => {
  let remote
  api.mockImplementation(async (path, options) => {
    if (path === '/api/data') {
      remote = JSON.parse(options.body).state
      delete remote.active // Match the real PUT /api/data contract.
    }
    return {}
  })
  useStore.getState().update(s => {
    s.active = { id: 'in-progress', start: Date.now(), entries: [{ id: '0025', sets: [{ reps: 8, weight: 20, done: false }] }] }
  }, false)
  const saved = structuredClone(useStore.getState().S)

  expect(await useStore.getState()[action]()).toBe(false)
  expect(remote.active).toBeUndefined()
  expect(remote.workouts).toEqual(saved.workouts)
  expect(useStore.getState().user).toBeNull()
  expect(useStore.getState().S).toEqual(saved)
  expect(JSON.parse(localStorage.getItem('gym_state_v1')).active).toEqual(saved.active)
  expect(localStorage.getItem('gym_dirty')).toBe('1')
})

it.each(['signOut', 'signOutAll'])('%s waits for an earlier autosave before uploading the final profile', async action => {
  let finishEarlier, remote, uploads = 0
  api.mockImplementation((path, options) => {
    if (path !== '/api/data') return Promise.resolve({})
    const state = JSON.parse(options.body).state
    delete state.active // The real API stores whichever request body finishes last.
    uploads++
    if (uploads === 1) return new Promise(resolve => {
      finishEarlier = () => { remote = state; resolve({}) }
    })
    remote = state
    return Promise.resolve({})
  })
  const earlier = useStore.getState().pushState()
  await vi.waitFor(() => expect(finishEarlier).toBeTypeOf('function'))
  useStore.getState().update(s => { s.workouts.push({ id: 'saved-later', entries: [] }) }, false)
  const signingOut = useStore.getState()[action]()
  await vi.advanceTimersByTimeAsync(0)
  const uploadsBeforeEarlierFinished = uploads
  const logoutBeforeEarlierFinished = api.mock.calls.some(([path]) => path.startsWith('/api/logout'))
  finishEarlier()
  await Promise.all([earlier, signingOut])

  expect(uploadsBeforeEarlierFinished).toBe(1)
  expect(logoutBeforeEarlierFinished).toBe(false)
  expect(remote.workouts.map(workout => workout.id)).toEqual(['unsynced', 'saved-later'])
  expect(api.mock.calls.map(([path]) => path)).toEqual(['/api/data', '/api/data', action === 'signOut' ? '/api/logout' : '/api/logout/all'])
  expect(useStore.getState().user).toBeNull()
  expect(useStore.getState().S.workouts).toEqual([])
})

it.each(['signOut', 'signOutAll'])('%s can retry after a failed queued upload', async action => {
  api.mockRejectedValueOnce(new Error('offline'))
  await expect(useStore.getState()[action]()).rejects.toThrow('offline')
  api.mockResolvedValue({})

  expect(await useStore.getState()[action]()).toBe(true)
  expect(api.mock.calls.map(([path]) => path)).toEqual(['/api/data', '/api/data', action === 'signOut' ? '/api/logout' : '/api/logout/all'])
  expect(useStore.getState().user).toBeNull()
  expect(useStore.getState().S.workouts).toEqual([])
})

it('does not send a queued profile using another account session', async () => {
  let finishEarlier
  api.mockImplementation(() => new Promise(resolve => { finishEarlier = resolve }))
  const earlier = useStore.getState().pushState()
  await vi.waitFor(() => expect(finishEarlier).toBeTypeOf('function'))
  useStore.getState().update(s => { s.workouts.push({ id: 'previous-account', entries: [] }) }, false)
  const queued = useStore.getState().pushState()
  useStore.getState().setUser({ id: 'other-user', name: 'Other QA' })
  finishEarlier({})
  await Promise.all([earlier, queued])

  expect(api).toHaveBeenCalledOnce()
  expect(useStore.getState().user.id).toBe('other-user')
})
