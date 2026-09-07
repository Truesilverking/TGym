import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { webcrypto } from 'node:crypto'
import { biometricEnabled, deviceLockEnabled, lockConfig, recoverWithKey, removeDevicePin, setBiometricEnabled, setDevicePin, verifyDevicePin } from './app-lock.js'

describe('device PIN', () => {
  beforeAll(() => {
    const data = new Map()
    globalThis.localStorage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k), clear: () => data.clear() }
    if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto })
  })
  beforeEach(() => localStorage.clear())
  it('stores a salted hash rather than the PIN and verifies four digits', async () => {
    await setDevicePin('1234')
    expect(deviceLockEnabled()).toBe(true)
    expect(JSON.stringify(lockConfig())).not.toContain('1234')
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
})
