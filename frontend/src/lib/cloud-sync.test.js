import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cloudBackupDue, WEEK_MS } from './cloud-sync.js'

describe('weekly cloud backup schedule', () => {
  const now = new Date('2026-09-01T12:00:00Z').getTime()
  it('is due on first connection and again after seven days', () => {
    expect(cloudBackupDue({ cloudSync: { on: true, clientId: 'client', lastBackupAt: null } }, now)).toBe(true)
    expect(cloudBackupDue({ cloudSync: { on: true, clientId: 'client', lastBackupAt: now - WEEK_MS } }, now)).toBe(true)
  })
  it('does not run early, while disabled, or before configuration', () => {
    expect(cloudBackupDue({ cloudSync: { on: true, clientId: 'client', lastBackupAt: now - WEEK_MS + 1 } }, now)).toBe(false)
    expect(cloudBackupDue({ cloudSync: { on: false, clientId: 'client' } }, now)).toBe(false)
    expect(cloudBackupDue({ cloudSync: { on: true, clientId: '' } }, now)).toBe(false)
    expect(cloudBackupDue({ cloudSync: { on: true, clientId: 'client', needsAuth: true, lastBackupAt: 0 } }, now)).toBe(false)
    expect(cloudBackupDue({ cloudSync: { on: true, clientId: 'client', lastAttemptAt: now - 1000, lastBackupAt: 0 } }, now)).toBe(false)
  })
})

const native = vi.hoisted(() => ({ on: false, authorize: vi.fn(), clearToken: vi.fn() }))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.on, getPlatform: () => native.on ? 'android' : 'web' }, registerPlugin: () => native }))
import { connectGoogleDrive, backupToGoogleDrive, forgetGoogleDriveToken, configuredGoogleClientId } from './cloud-sync.js'
const state = () => ({ routines: [], workouts: [], cloudSync: { on: true } })
const response = (body, status = 200) => new Response(JSON.stringify(body), { status })
beforeEach(() => {
  native.on = false
  forgetGoogleDriveToken()
  vi.restoreAllMocks()
  native.authorize.mockReset().mockResolvedValue({ accessToken: 'fresh', expiresIn: 3000 })
  native.clearToken.mockReset().mockResolvedValue({})
})
describe('Drive account and backup recovery', () => {
  it('provides the public web client only on the authorized hosted origin', () => {
    try {
      vi.stubGlobal('location', { origin: 'https://truesilverking.github.io' })
      expect(configuredGoogleClientId({})).toMatch(/\.apps\.googleusercontent\.com$/)
      vi.stubGlobal('location', { origin: 'https://example.com' })
      expect(configuredGoogleClientId({})).toBe('')
      expect(configuredGoogleClientId({ cloudSync: { clientId: 'custom' } })).toBe('custom')
    } finally { vi.unstubAllGlobals() }
  })
  it('connects without replacing an existing backup', async () => {
    native.on = true
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ files: [{ id: 'existing' }] }))
    expect(await connectGoogleDrive(state())).toEqual({ hasBackup: true })
    expect(fetcher).toHaveBeenCalledOnce()
    expect(fetcher.mock.calls[0][1].method).toBeUndefined()
  })
  it('clears rejected native credentials and renews once on 401', async () => {
    native.on = true
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response({}, 401)).mockResolvedValue(response({ files: [] }))
    await connectGoogleDrive(state())
    expect(native.clearToken).toHaveBeenCalledWith({ accessToken: 'fresh' })
    expect(native.authorize).toHaveBeenCalledTimes(2)
    expect(native.authorize).toHaveBeenLastCalledWith({ interactive: false })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
  it('does not loop endlessly when a renewed token is rejected', async () => {
    native.on = true
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({}, 401))
    await expect(connectGoogleDrive(state())).rejects.toMatchObject({ code: 'auth_required' })
    expect(native.authorize).toHaveBeenCalledTimes(2)
  })
  it('preserves success metadata when only the history upload fails', async () => {
    native.on = true
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response({ files: [] }))
      .mockResolvedValueOnce(response({ id: 'saved', modifiedTime: '2026-09-10T12:00:00Z' }))
      .mockResolvedValueOnce(response({}, 503))
    const saved = await backupToGoogleDrive(state())
    expect(saved.fileId).toBe('saved')
    expect(saved.modifiedTime).toBe('2026-09-10T12:00:00Z')
    expect(saved.warning).toBeTruthy()
  })
  it('does not overwrite another device before synchronizing', async () => {
    native.on = true
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ files: [{ id: 'remote', modifiedTime: 'changed' }] }))
    await expect(backupToGoogleDrive(state())).rejects.toMatchObject({ code: 'sync_required' })
    expect(fetcher).toHaveBeenCalledOnce()
  })
})
