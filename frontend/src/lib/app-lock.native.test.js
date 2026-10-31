import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'

const native = vi.hoisted(() => ({ authenticate: vi.fn() }))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }))
vi.mock('@aparajita/capacitor-biometric-auth', () => ({
  AndroidBiometryStrength: { weak: 0 },
  BiometricAuth: { authenticate: native.authenticate },
}))
import { authenticateDeviceBiometry, enrollDeviceBiometry, lockConfig, removeDevicePin, setBiometricEnabled, setDevicePin } from './app-lock.js'

let data
beforeEach(() => {
  vi.resetAllMocks()
  data = new Map([['training-profile', '{"history":["synthetic-workout"]}']])
  vi.stubGlobal('localStorage', {
    getItem: key => data.get(key) ?? null,
    setItem: vi.fn((key, value) => data.set(key, String(value))),
    removeItem: vi.fn(key => data.delete(key)),
  })
  vi.stubGlobal('crypto', webcrypto)
})
afterEach(() => vi.unstubAllGlobals())

async function prompt(operation = authenticateDeviceBiometry) {
  let resolve, reject
  native.authenticate.mockReturnValueOnce(new Promise((yes, no) => { resolve = yes; reject = no }))
  // Attach the rejection handler before resolving the simulated native prompt.
  const result = operation().then(value => ({ value }), error => ({ error }))
  await vi.dynamicImportSettled()
  expect(native.authenticate).toHaveBeenCalledOnce()
  return { resolve, reject, result }
}
function unchangedAfterPrompt() {
  const before = [...data]
  localStorage.setItem.mockClear(); localStorage.removeItem.mockClear()
  return () => {
    expect([...data]).toEqual(before)
    expect(localStorage.setItem).not.toHaveBeenCalled()
    expect(localStorage.removeItem).not.toHaveBeenCalled()
  }
}

describe('native biometric authentication with pending credential changes', () => {
  it('accepts the unchanged PIN after a native prompt without writing app data', async () => {
    await setDevicePin('1234'); setBiometricEnabled(true)
    const pending = await prompt(), assertUnchanged = unchangedAfterPrompt()
    expect(native.authenticate.mock.calls[0][0]).toMatchObject({ allowDeviceCredential: false, androidConfirmationRequired: false })
    pending.resolve()
    expect(await pending.result).toEqual({ value: true }); assertUnchanged()
  })

  it.each([
    ['PIN replacement', () => setDevicePin('5678')],
    ['lock removal', () => removeDevicePin()],
    ['biometrics disabled', () => setBiometricEnabled(false)],
  ])('rejects a late native success after %s and leaves the current data intact', async (description, change) => {
    await setDevicePin('1234'); setBiometricEnabled(true)
    const pending = await prompt()
    await change()
    const assertUnchanged = unchangedAfterPrompt()
    pending.resolve()
    const result = await pending.result
    expect(result.error).toBeInstanceOf(Error)
    expect(result.error.message).toContain('Device lock changed')
    expect(result).not.toHaveProperty('value'); assertUnchanged()
  })

  it('preserves concurrent noncredential fields when native authentication succeeds', async () => {
    await setDevicePin('1234'); setBiometricEnabled(true)
    const pending = await prompt()
    localStorage.setItem('framegym_device_lock_v1', JSON.stringify({ ...lockConfig(), attempts: 2, blockedUntil: 5000, timeoutMin: 10 }))
    const assertUnchanged = unchangedAfterPrompt()
    pending.resolve()
    expect(await pending.result).toEqual({ value: true }); assertUnchanged()
  })

  it('allows native enrollment before the biometric preference is enabled', async () => {
    await setDevicePin('1234')
    expect(lockConfig().biometric).toBeUndefined()
    const pending = await prompt(enrollDeviceBiometry), assertUnchanged = unchangedAfterPrompt()
    pending.resolve()
    expect(await pending.result).toEqual({ value: true }); assertUnchanged()
    expect(lockConfig().biometric).toBeUndefined()
  })

  it('retains the existing no-PIN native authentication contract without creating a lock', async () => {
    const pending = await prompt(), assertUnchanged = unchangedAfterPrompt()
    pending.resolve()
    expect(await pending.result).toEqual({ value: true }); assertUnchanged()
    expect(lockConfig()).toBeNull()
  })

  it('rejects a native result started before a PIN was created', async () => {
    const pending = await prompt()
    await setDevicePin('1234')
    const assertUnchanged = unchangedAfterPrompt()
    pending.resolve()
    expect((await pending.result).error).toBeInstanceOf(Error); assertUnchanged()
  })

  it('propagates native cancellation without changing the PIN or profile', async () => {
    await setDevicePin('1234'); setBiometricEnabled(true)
    const pending = await prompt(), assertUnchanged = unchangedAfterPrompt()
    const canceled = new Error('Synthetic native cancellation')
    pending.reject(canceled)
    expect(await pending.result).toEqual({ error: canceled }); assertUnchanged()
  })
})
