import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { authenticateDeviceBiometry, biometricEnabled, deviceLockEnabled, enrollDeviceBiometry, lockConfig, recoverWithKey, removeDevicePin, setBiometricEnabled, setDevicePin, verifyDevicePin } from './app-lock.js'

describe('device PIN', () => {
  beforeAll(() => {
    const data = new Map()
    globalThis.localStorage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k), clear: () => data.clear() }
    if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto })
  })
  beforeEach(() => localStorage.clear())
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
  it('stores a salted hash rather than the PIN and verifies four digits', async () => {
    await setDevicePin('1234')
    expect(deviceLockEnabled()).toBe(true)
    const cfg = lockConfig()
    expect(cfg).not.toHaveProperty('pin')
    expect(cfg.hash).toMatch(/^[a-f0-9]{64}$/)
    expect(Object.values(cfg)).not.toContain('1234')
    expect((await verifyDevicePin('1234')).ok).toBe(true)
  })
  it('adds a progressive delay after repeated failures', async () => {
    await setDevicePin('1234')
    await verifyDevicePin('0000', 1000); await verifyDevicePin('0000', 1000)
    expect((await verifyDevicePin('0000', 1000)).waitMs).toBe(5000)
    expect((await verifyDevicePin('1234', 1001)).ok).toBe(false)
  })
  it('can be removed without touching application data', async () => {
    await setDevicePin('1234'); removeDevicePin(); expect(deviceLockEnabled()).toBe(false)
  })
  it('stores the optional biometric preference beside the PIN configuration', async () => {
    expect(setBiometricEnabled(true)).toBe(false)
    await setDevicePin('1234')
    expect(setBiometricEnabled(true)).toBe(true)
    expect(biometricEnabled()).toBe(true)
    setBiometricEnabled(false)
    expect(biometricEnabled()).toBe(false)
  })
  it('creates a one-time recovery key that removes the device lock', async () => {
    const key = await setDevicePin('1234')
    expect(key).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/)
    expect(JSON.stringify(lockConfig())).not.toContain(key)
    expect(await recoverWithKey(key)).toBe(true)
    expect(deviceLockEnabled()).toBe(false)
  })
  function holdDigest() {
    const original = crypto.subtle.digest.bind(crypto.subtle)
    let release
    const pending = new Promise(resolve => { release = resolve })
    vi.spyOn(crypto.subtle, 'digest').mockImplementationOnce(async (...args) => { await pending; return original(...args) })
    return release
  }
  it('does not remove the lock when recovery is canceled during verification', async () => {
    const key = await setDevicePin('1234'), before = localStorage.getItem('framegym_device_lock_v1')
    let active = true
    const release = holdDigest(), result = recoverWithKey(key, () => active)
    active = false; release()
    expect(await result).toBe(false)
    expect(localStorage.getItem('framegym_device_lock_v1')).toBe(before)
  })
  it('never removes a newer PIN configuration with an older recovery operation', async () => {
    const key = await setDevicePin('1234'), release = holdDigest(), result = recoverWithKey(key)
    await setDevicePin('5678')
    const current = localStorage.getItem('framegym_device_lock_v1'); release()
    expect(await result).toBe(false)
    expect(localStorage.getItem('framegym_device_lock_v1')).toBe(current)
    expect((await verifyDevicePin('5678')).ok).toBe(true)
  })
  it('never restores an older PIN configuration after asynchronous verification', async () => {
    await setDevicePin('1234')
    const release = holdDigest(), result = verifyDevicePin('1234')
    await setDevicePin('5678')
    const current = localStorage.getItem('framegym_device_lock_v1'); release()
    expect((await result).ok).toBe(false)
    expect(localStorage.getItem('framegym_device_lock_v1')).toBe(current)
  })
  it('preserves a concurrent biometric preference change on PIN success', async () => {
    await setDevicePin('1234')
    const release = holdDigest(), result = verifyDevicePin('1234')
    setBiometricEnabled(true); release()
    expect((await result).ok).toBe(true); expect(biometricEnabled()).toBe(true)
  })
  it('counts concurrent failed verifications against the live attempt limit', async () => {
    await setDevicePin('1234')
    await Promise.all([verifyDevicePin('0000', 1000), verifyDevicePin('0000', 1000), verifyDevicePin('0000', 1000)])
    expect(lockConfig().attempts).toBe(3); expect(lockConfig().blockedUntil).toBe(6000)
  })
  function holdCredential(method) {
    let finish, entered
    const called = new Promise(resolve => { entered = resolve })
    const request = new Promise(resolve => { finish = () => resolve({ rawId: new Uint8Array([1, 2, 3]).buffer }) })
    vi.stubGlobal('navigator', { credentials: { [method]: () => { entered(); return request } } })
    return { called, finish }
  }
  it.each(['replace', 'remove'])('rejects old biometric enrollment after the PIN is changed: %s', async change => {
    await setDevicePin('1234')
    const held = holdCredential('create'), pending = enrollDeviceBiometry()
    await held.called
    if (change === 'replace') await setDevicePin('5678'); else removeDevicePin()
    const before = localStorage.getItem('framegym_device_lock_v1'); held.finish()
    await expect(pending).rejects.toThrow()
    expect(localStorage.getItem('framegym_device_lock_v1')).toBe(before)
  })
  it('preserves the latest biometric preference while attaching a platform credential', async () => {
    await setDevicePin('1234')
    const held = holdCredential('create'), pending = enrollDeviceBiometry()
    await held.called; setBiometricEnabled(true); held.finish(); await pending
    expect(biometricEnabled()).toBe(true); expect(lockConfig().webCredentialId).toBe('AQID')
  })
  it.each(['replace', 'remove', 'disable', 'reenroll'])('rejects a pending biometric result after its lock changes: %s', async change => {
    await setDevicePin('1234'); setBiometricEnabled(true)
    const cfg = lockConfig(); localStorage.setItem('framegym_device_lock_v1', JSON.stringify({ ...cfg, webCredentialId: 'AQID' }))
    const held = holdCredential('get'), pending = authenticateDeviceBiometry()
    await held.called
    if (change === 'replace') await setDevicePin('5678')
    else if (change === 'remove') removeDevicePin()
    else if (change === 'disable') setBiometricEnabled(false)
    else localStorage.setItem('framegym_device_lock_v1', JSON.stringify({ ...lockConfig(), webCredentialId: 'BAUG' }))
    const before = localStorage.getItem('framegym_device_lock_v1'); held.finish()
    await expect(pending).rejects.toThrow()
    expect(localStorage.getItem('framegym_device_lock_v1')).toBe(before)
  })
})
