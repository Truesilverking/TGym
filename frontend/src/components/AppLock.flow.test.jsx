// @vitest-environment happy-dom
import React, { act, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import AppLock from './AppLock.jsx'
import { verifyDevicePin, recoverWithKey, authenticateDeviceBiometry } from '../lib/app-lock.js'
import { setLang } from '../lib/i18n.js'
const config = vi.hoisted(() => ({ biometric: false, blockedUntil: 0 }))
vi.mock('../lib/app-lock.js', () => ({ deviceLockEnabled: () => true, lockConfig: () => config, biometricEnabled: () => config.biometric, verifyDevicePin: vi.fn(), recoverWithKey: vi.fn(), authenticateDeviceBiometry: vi.fn() }))
let host, root
beforeEach(async () => {
 globalThis.IS_REACT_ACT_ENVIRONMENT = true; vi.resetAllMocks(); config.biometric = false; config.blockedUntil = 0
 verifyDevicePin.mockResolvedValue({ ok: false }); recoverWithKey.mockResolvedValue(false)
 Object.defineProperty(document, 'hidden', { configurable: true, value: false })
 await setLang('en'); host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers() })
const render = () => act(async () => root.render(<AppLock><b>Private training data</b></AppLock>))
async function enter(text) { await act(async () => { const input = host.querySelector('input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, text); input.dispatchEvent(new Event('input', { bubbles: true })) }) }
async function click(selector) { await act(async () => host.querySelector(selector).click()) }
async function submit() { await act(async () => host.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))) }
async function visibility(hidden) { await act(async () => { Object.defineProperty(document, 'hidden', { configurable: true, value: hidden }); document.dispatchEvent(new Event('visibilitychange')) }) }
it('masks the PIN and verifies automatically only when fresh input completes four digits', async () => {
 await render(); await enter('123'); await click('[aria-label="Show key"]')
 expect(host.querySelector('input').type).toBe('text'); expect(verifyDevicePin).not.toHaveBeenCalled()
 await enter('1234'); expect(verifyDevicePin).toHaveBeenCalledExactlyOnceWith('1234')
 expect(host.querySelector('[role=alert]').textContent).toBe('Incorrect PIN'); expect(host.querySelector('input').value).toBe(''); expect(host.querySelector('input').type).toBe('password')
 expect(host.querySelector('input').getAttribute('aria-describedby')).toBe('app-unlock-error'); expect(host.textContent).not.toContain('Private training data')
 verifyDevicePin.mockResolvedValueOnce({ ok: true }); await enter('4321'); expect(host.textContent).toBe('Private training data')
})
it('supports keypad leading zeroes and deleting without submitting incomplete PINs', async () => {
 await render(); await click('[data-pin-digit="0"]'); await click('[data-pin-digit="7"]'); await click('[aria-label="Delete last digit"]')
 expect(host.querySelector('input').value).toBe('0'); expect(verifyDevicePin).not.toHaveBeenCalled()
 await click('[data-pin-digit="0"]'); await click('[data-pin-digit="1"]'); await click('[data-pin-digit="2"]'); expect(verifyDevicePin).toHaveBeenCalledExactlyOnceWith('0012')
})
it('preserves explicit recovery verification and masks mode changes', async () => {
 await render(); await click('[aria-label="Show key"]'); await click('.lock-recovery')
 expect(host.querySelector('input').type).toBe('password'); expect(host.querySelector('input').inputMode).toBe('text'); expect(host.querySelector('.lock-keypad')).toBeNull()
 await enter('abcd-1234-efgh-5678'); expect(recoverWithKey).not.toHaveBeenCalled(); await submit()
 expect(recoverWithKey).toHaveBeenCalledWith('ABCD-1234-EFGH-5678', expect.any(Function)); expect(verifyDevicePin).not.toHaveBeenCalled(); expect(host.querySelector('[role=alert]').textContent).toBe('Invalid recovery key')
 recoverWithKey.mockResolvedValueOnce(true); await submit(); expect(host.textContent).toBe('Private training data')
})
it('restores focus after async rejection, blocks double submits and never retries on a render', async () => {
 let finish; verifyDevicePin.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
 await render(); await click('[data-pin-digit="1"]'); await enter('1234'); const input = host.querySelector('input')
 expect(input.disabled).toBe(true); expect(host.textContent).toContain('Verifying…'); await submit(); expect(verifyDevicePin).toHaveBeenCalledTimes(1)
 await act(async () => finish({ ok: false })); expect(input.disabled).toBe(false); expect(document.activeElement).toBe(input)
 await render(); expect(verifyDevicePin).toHaveBeenCalledTimes(1)
})
it('announces canceled biometrics, returns focus to PIN and permits biometric retry', async () => {
 config.biometric = true; let cancel; authenticateDeviceBiometry.mockImplementationOnce(() => new Promise((resolve, reject) => { cancel = reject }))
 await render(); expect(host.querySelector('input').disabled).toBe(true); expect(host.textContent).toContain('Waiting for biometrics…')
 await act(async () => cancel(new Error('cancelled'))); expect(host.textContent).toContain('Use your PIN or try biometrics again.'); expect(host.textContent).not.toContain('Private training data'); expect(document.activeElement).toBe(host.querySelector('input'))
 authenticateDeviceBiometry.mockResolvedValueOnce(true); await click('.lock-biometric'); expect(host.textContent).toBe('Private training data'); expect(verifyDevicePin).not.toHaveBeenCalled()
})
it('shows persisted cooldown and keeps recovery available without spending another attempt', async () => {
 vi.useFakeTimers(); vi.setSystemTime(100000); config.blockedUntil = 105000
 await render(); expect(host.textContent).toContain('Try again in 5s'); expect(host.querySelector('input').disabled).toBe(true); expect(host.querySelector('[data-pin-digit="1"]').disabled).toBe(true)
 await enter('1234'); await submit(); expect(verifyDevicePin).not.toHaveBeenCalled(); await click('.lock-recovery'); expect(host.querySelector('input').disabled).toBe(false)
 await click('.lock-recovery'); await act(async () => vi.advanceTimersByTime(5000)); expect(host.querySelector('input').disabled).toBe(false); expect(document.activeElement).toBe(host.querySelector('input'))
 await enter('4321'); expect(verifyDevicePin).toHaveBeenCalledExactlyOnceWith('4321')
})
it('expires the verifier cooldown without automatic resubmission', async () => {
 vi.useFakeTimers(); vi.setSystemTime(100000); verifyDevicePin.mockResolvedValueOnce({ ok: false, waitMs: 5000 })
 await render(); await enter('0000'); expect(host.textContent).toContain('Try again in 5s'); expect(host.querySelector('input').disabled).toBe(true)
 await act(async () => vi.advanceTimersByTime(5000)); expect(host.querySelector('input').disabled).toBe(false); expect(verifyDevicePin).toHaveBeenCalledTimes(1)
})
it('clears a visible partial key in background and resets recovery after five minutes', async () => {
 vi.useFakeTimers(); vi.setSystemTime(100000); await render(); await click('.lock-recovery'); await enter('ABCD'); await click('[aria-label="Show key"]'); await visibility(true)
 expect(document.body.classList.contains('framegym-private')).toBe(true); expect(host.querySelector('input').value).toBe(''); expect(host.querySelector('input').type).toBe('password')
 await act(async () => vi.advanceTimersByTime(300001)); await visibility(false)
 expect(document.body.classList.contains('framegym-private')).toBe(false); expect(host.querySelector('.lock-keypad')).not.toBeNull(); expect(host.textContent).not.toContain('Private training data')
})
it('ignores a stale success after a long background relock', async () => {
 vi.useFakeTimers(); vi.setSystemTime(100000); let finish; verifyDevicePin.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
 await render(); await enter('1234'); await visibility(true); await act(async () => vi.advanceTimersByTime(300001)); await visibility(false); await act(async () => finish({ ok: true }))
 expect(host.textContent).not.toContain('Private training data'); expect(host.querySelector('input').disabled).toBe(false)
})
it('relocks previously unlocked content after five minutes away', async () => {
 vi.useFakeTimers(); vi.setSystemTime(100000); verifyDevicePin.mockResolvedValueOnce({ ok: true }); await render(); await enter('1234'); expect(host.textContent).toBe('Private training data')
 await visibility(true); await act(async () => vi.advanceTimersByTime(300001)); await visibility(false)
 expect(host.querySelector('.lock-keypad')).not.toBeNull(); expect(host.textContent).not.toContain('Private training data')
})
it('keeps data locked on an exception and permits a clean retry', async () => {
 verifyDevicePin.mockRejectedValueOnce(new Error('storage unavailable')); await render(); await enter('1234')
 expect(host.querySelector('[role=alert]').textContent).toBe('Could not unlock. Try again.'); expect(host.querySelector('input').disabled).toBe(false); expect(host.querySelector('input').value).toBe('')
 verifyDevicePin.mockResolvedValueOnce({ ok: true }); await enter('4321'); expect(host.textContent).toBe('Private training data')
})
it('keeps one live biometric operation through StrictMode effect replay', async () => {
 config.biometric = true; let finish
 authenticateDeviceBiometry.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
 await act(async () => root.render(<StrictMode><AppLock><b>Private training data</b></AppLock></StrictMode>))
 expect(authenticateDeviceBiometry).toHaveBeenCalledTimes(1)
 await act(async () => finish(true))
 expect(host.textContent).toBe('Private training data')
})
it('keeps the cooldown visible after biometric cancellation while PIN is unavailable', async () => {
 vi.useFakeTimers(); vi.setSystemTime(100000); config.biometric = true; config.blockedUntil = 105000
 authenticateDeviceBiometry.mockRejectedValueOnce(new Error('cancelled')); await render()
 expect(host.textContent).toContain('Try again in 5s')
 expect(host.textContent).not.toContain('Use your PIN or try biometrics again.')
 expect(host.querySelector('input').disabled).toBe(true)
})
it('withdraws permission to remove the lock when pending recovery outlives a relock', async () => {
 vi.useFakeTimers(); vi.setSystemTime(100000); let finish
 recoverWithKey.mockImplementationOnce((key, canApply) => new Promise(resolve => { finish = () => resolve(canApply()) }))
 await render(); await click('.lock-recovery'); await enter('ABCD-1234-EFGH-5678'); await submit()
 const canApply = recoverWithKey.mock.calls[0][1]
 expect(canApply()).toBe(true)
 await visibility(true); await act(async () => vi.advanceTimersByTime(300001)); await visibility(false)
 expect(canApply()).toBe(false); await act(async () => finish())
 expect(host.textContent).not.toContain('Private training data'); expect(host.querySelector('.lock-keypad')).not.toBeNull()
})
