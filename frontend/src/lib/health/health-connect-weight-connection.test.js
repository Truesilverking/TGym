// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({ platform: 'android', native: { status: vi.fn(), connect: vi.fn(), readWeights: vi.fn(), openSettings: vi.fn() }, store: null }))
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => mock.platform }, registerPlugin: () => mock.native }))
vi.mock('../../store/useStore.js', () => ({ useStore: { getState: () => mock.store } }))
const now = Date.parse('2026-11-21T16:00:00Z'), time = now - 3600000
const reading = () => ({ complete: true, from: now - 30 * 86400000, to: now, records: [
  { id: 'synthetic-weight', origin: 'com.withings.wiscale2', time, updatedAt: time + 1000, weightKg: 80 },
] })
const enabled = () => ({ unit: 'kg', bodyweight: [], workouts: [{ id: 'kept-history' }], routines: [{ id: 'kept-routine' }], active: { id: 'kept-active', bw: 75 },
  scaleWeightSource: 'health-connect', healthConnectWeight: { enabled: true, autoSync: true, lastSyncAt: 0, generation: 'synthetic-generation' },
  smartScaleConnection: { enabled: false, lastSync: 123, generation: 'synthetic-api-generation' } })
const module = () => import('./health-connect-weight-connection.js')
const settleRead = async () => { for (let i = 0; i < 20 && !mock.native.readWeights.mock.calls.length; i++) await Promise.resolve(); expect(mock.native.readWeights).toHaveBeenCalledOnce() }

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(now); mock.platform = 'android'
  mock.store = { S: enabled(), updateAtomic: vi.fn(async function (mutate) { const next = structuredClone(this.S); mutate(next); this.S = next }), flushPersistence: vi.fn().mockResolvedValue(undefined) }
  mock.native.status.mockResolvedValue({ available: true, granted: true })
  mock.native.connect.mockResolvedValue({ available: true, granted: true })
  mock.native.readWeights.mockResolvedValue(reading()); mock.native.openSettings.mockResolvedValue(undefined)
})
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks() })

describe('on-device Health Connect weight connection', () => {
  it('does nothing on web and never asks permission while merely reading status', async () => {
    mock.platform = 'web'; const api = await module()
    expect(await api.healthConnectWeightStatus()).toEqual({ available: false, granted: false })
    expect(mock.native.status).not.toHaveBeenCalled(); expect(mock.native.connect).not.toHaveBeenCalled()
    await expect(api.connectHealthConnectWeight()).rejects.toMatchObject({ code: 'health-weight-unavailable' })
  })
  it('requires an explicit granted connection and switches off the API source atomically', async () => {
    mock.store.S.scaleWeightSource = 'withings'; mock.store.S.smartScaleConnection.enabled = true
    const oldApiGeneration = mock.store.S.smartScaleConnection.generation
    const before = structuredClone(mock.store.S), api = await module()
    expect(await api.healthConnectWeightStatus()).toEqual({ available: true, granted: true })
    expect(mock.native.connect).not.toHaveBeenCalled()
    expect(await api.connectHealthConnectWeight()).toEqual({ available: true, granted: true })
    expect(mock.store.S).toMatchObject({ scaleWeightSource: 'health-connect', healthConnectWeight: { enabled: true, autoSync: true, lastSyncAt: 0 }, smartScaleConnection: { enabled: false, lastSync: 123 } })
    expect(mock.store.S.smartScaleConnection.generation).not.toBe(oldApiGeneration)
    for (const key of ['bodyweight', 'workouts', 'routines', 'active']) expect(mock.store.S[key]).toEqual(before[key])
    expect(mock.store.flushPersistence).toHaveBeenCalledOnce()
  })
  it('does not save a denied permission or overwrite a source selected while the permission sheet was open', async () => {
    const api = await module(), before = structuredClone(mock.store.S)
    mock.native.connect.mockResolvedValueOnce({ available: true, granted: false })
    await expect(api.connectHealthConnectWeight()).rejects.toMatchObject({ code: 'health-weight-permission' })
    expect(mock.store.S).toEqual(before)
    let grant; mock.native.connect.mockImplementationOnce(() => new Promise(resolve => { grant = resolve }))
    const connecting = api.connectHealthConnectWeight()
    mock.store.S.scaleWeightSource = 'withings'; mock.store.S.healthConnectWeight.generation = 'new-source-choice'
    grant({ available: true, granted: true })
    await expect(connecting).rejects.toMatchObject({ code: 'health-weight-connection-changed' })
    expect(mock.store.S.scaleWeightSource).toBe('withings')
  })
  it('rejects a malformed native connection status without enabling import', async () => {
    const before = structuredClone(mock.store.S), api = await module()
    mock.native.connect.mockResolvedValue({ available: 'true', granted: true })
    await expect(api.connectHealthConnectWeight()).rejects.toMatchObject({ code: 'health-weight-unavailable' })
    expect(mock.store.S).toEqual(before)
  })
  it('coalesces simultaneous imports, waits for persistence and keeps recorded training intact', async () => {
    const api = await module(), before = structuredClone(mock.store.S)
    const one = api.syncHealthConnectWeight(), two = api.syncHealthConnectWeight({ automatic: true })
    expect(one).toBe(two)
    expect(await one).toEqual({ added: 1, updated: 0, unchanged: 0, readings: 1 })
    expect(mock.native.readWeights).toHaveBeenCalledOnce(); expect(mock.store.flushPersistence).toHaveBeenCalledOnce()
    expect(mock.store.S.bodyweight[0]).toMatchObject({ w: 80, samples: [{ source: 'health-connect', origin: 'com.withings.wiscale2' }] })
    for (const key of ['workouts', 'routines', 'active']) expect(mock.store.S[key]).toEqual(before[key])
  })
  it('honours automatic enablement/cooldown while allowing a manual retry', async () => {
    const api = await module(); mock.store.S.healthConnectWeight.lastSyncAt = now
    expect(await api.syncHealthConnectWeight({ automatic: true })).toBeNull(); expect(mock.native.readWeights).not.toHaveBeenCalled()
    expect((await api.syncHealthConnectWeight()).added).toBe(1)
    mock.native.readWeights.mockClear(); await api.setHealthConnectWeightAutoSync(false)
    expect(await api.syncHealthConnectWeight({ automatic: true })).toBeNull(); expect(mock.native.readWeights).not.toHaveBeenCalled()
    await api.disconnectHealthConnectWeight()
    expect(await api.syncHealthConnectWeight({ automatic: true })).toBeNull()
    await expect(api.syncHealthConnectWeight()).rejects.toMatchObject({ code: 'health-weight-not-connected' })
  })
  it.each(['before', 'after'])('does not import if permission is revoked %s native reading', async phase => {
    const api = await module(), before = structuredClone(mock.store.S)
    if (phase === 'before') mock.native.status.mockResolvedValue({ available: true, granted: false })
    else mock.native.status.mockResolvedValueOnce({ available: true, granted: true }).mockResolvedValueOnce({ available: true, granted: false })
    await expect(api.syncHealthConnectWeight()).rejects.toMatchObject({ code: 'health-weight-permission' })
    expect(mock.store.S).toEqual(before); expect(mock.store.flushPersistence).not.toHaveBeenCalled()
  })
  it.each(['disconnect', 'source'])('discards a late read after %s instead of re-enabling the old connection', async kind => {
    let finish; mock.native.readWeights.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const api = await module(), pending = api.syncHealthConnectWeight()
    await settleRead()
    if (kind === 'disconnect') await api.disconnectHealthConnectWeight()
    else { mock.store.S.scaleWeightSource = 'withings'; mock.store.S.healthConnectWeight.generation = 'withings-selected' }
    finish(reading()); await expect(pending).rejects.toMatchObject({ code: 'health-weight-connection-changed' })
    expect(mock.store.S.bodyweight).toEqual([])
  })
  it.each(['generation', 'lastSyncAt', 'autoSync'])('captures a stable settings snapshot and discards a late read after %s changes', async field => {
    let finish; mock.native.readWeights.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const api = await module(), pending = api.syncHealthConnectWeight()
    await settleRead()
    mock.store.S.healthConnectWeight[field] = field === 'generation' ? 'new-generation' : field === 'lastSyncAt' ? now : false
    finish(reading())
    await expect(pending).rejects.toMatchObject({ code: 'health-weight-connection-changed' })
    expect(mock.store.S.bodyweight).toEqual([])
    expect(mock.store.flushPersistence).not.toHaveBeenCalled()
  })
  it('rolls back a failed primary write and retries once without duplicate readings', async () => {
    const api = await module(), before = structuredClone(mock.store.S)
    mock.store.updateAtomic.mockRejectedValueOnce(Object.assign(Error('synthetic quota'), { name: 'QuotaExceededError' }))
    await expect(api.syncHealthConnectWeight()).rejects.toThrow('synthetic quota')
    expect(mock.store.S).toEqual(before); expect(mock.store.flushPersistence).not.toHaveBeenCalled()
    expect((await api.syncHealthConnectWeight()).added).toBe(1)
    expect((await api.syncHealthConnectWeight()).unchanged).toBe(1)
    expect(mock.store.S.bodyweight[0].samples).toHaveLength(1)
  })
  it('does not report success on mirror failure and a manual retry remains idempotent', async () => {
    const api = await module(); mock.store.flushPersistence.mockRejectedValueOnce(Error('synthetic mirror failure'))
    await expect(api.syncHealthConnectWeight()).rejects.toThrow('synthetic mirror failure')
    expect(mock.store.S.bodyweight[0].samples).toHaveLength(1)
    expect((await api.syncHealthConnectWeight()).unchanged).toBe(1)
    expect(mock.store.S.bodyweight[0].samples).toHaveLength(1)
  })
  it('rejects incomplete native responses before saving rows or a successful cursor', async () => {
    mock.native.readWeights.mockResolvedValue({ ...reading(), complete: false })
    const api = await module(), before = structuredClone(mock.store.S)
    await expect(api.syncHealthConnectWeight()).rejects.toThrow('Invalid Health Connect')
    expect(mock.store.S).toEqual(before)
  })
  it('bounds an unresponsive native read and never imports its late response', async () => {
    let finish; mock.native.readWeights.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const api = await module(), before = structuredClone(mock.store.S), pending = api.syncHealthConnectWeight()
    const rejection = expect(pending).rejects.toMatchObject({ code: 'health-weight-read-timeout' })
    await settleRead(); await vi.advanceTimersByTimeAsync(15000); await rejection
    finish(reading()); await Promise.resolve(); expect(mock.store.S).toEqual(before)
  })
  it.each(['before', 'after'])('bounds an unresponsive permission status %s reading without saving a cursor or measurement', async phase => {
    let finish
    const hanging = () => new Promise(resolve => { finish = resolve })
    if (phase === 'before') mock.native.status.mockImplementationOnce(hanging)
    else mock.native.status.mockResolvedValueOnce({ available: true, granted: true }).mockImplementationOnce(hanging)
    const api = await module(), before = structuredClone(mock.store.S), pending = api.syncHealthConnectWeight()
    const rejection = expect(pending).rejects.toMatchObject({ code: 'health-weight-status-timeout' })
    if (phase === 'after') await settleRead()
    await vi.advanceTimersByTimeAsync(5000); await rejection
    finish({ available: true, granted: true }); await Promise.resolve()
    expect(mock.store.S).toEqual(before); expect(mock.store.flushPersistence).not.toHaveBeenCalled()
    if (phase === 'before') expect(mock.native.readWeights).not.toHaveBeenCalled()
  })
  it('opens native permission management only through an explicit call', async () => {
    const api = await module(); expect(mock.native.openSettings).not.toHaveBeenCalled()
    await api.openHealthConnectWeightSettings(); expect(mock.native.openSettings).toHaveBeenCalledOnce()
  })
})
