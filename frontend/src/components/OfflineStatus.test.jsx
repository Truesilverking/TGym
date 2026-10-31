// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import OfflineStatus from './OfflineStatus.jsx'

vi.mock('../lib/mobile.js', () => ({ MOBILE: false }))
vi.mock('../lib/i18n.js', () => ({ t: value => value }))
let host, root, worker, registration, register, getRegistration, secure, serviceWorker

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true; vi.stubEnv('DEV', false)
  secure = Object.getOwnPropertyDescriptor(window, 'isSecureContext')
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
  serviceWorker = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker')
  vi.stubGlobal('MessageChannel', class {
    constructor() {
      this.port1 = { onmessage: null, close: vi.fn() }
      this.port2 = { close: vi.fn(), postMessage: data => queueMicrotask(() => this.port1.onmessage?.({ data })) }
    }
  })
  worker = { postMessage: vi.fn((_, ports) => ports[0].postMessage({ ready: true })) }
  registration = { active: worker, installing: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), update: vi.fn(async () => {}) }
  register = vi.fn().mockRejectedValue(new TypeError('Offline worker script request failed'))
  getRegistration = vi.fn().mockResolvedValue(registration)
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register, getRegistration } })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => {
  await act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers()
  if (secure) Object.defineProperty(window, 'isSecureContext', secure); else delete window.isSecureContext
  if (serviceWorker) Object.defineProperty(navigator, 'serviceWorker', serviceWorker); else delete navigator.serviceWorker
})

it('uses an already installed cached worker offline without requiring another network registration', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  await act(async () => root.render(<OfflineStatus />))
  expect(getRegistration).toHaveBeenCalledOnce()
  expect(register).not.toHaveBeenCalled()
  expect(worker.postMessage).toHaveBeenCalledWith({ type: 'OFFLINE_STATUS' }, expect.any(Array))
  expect(host.textContent).toContain('Offline. Server actions need a connection.')
  expect(host.textContent).not.toContain('not ready')
})

it('keeps verified offline readiness if a background worker update request fails online', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  await act(async () => root.render(<OfflineStatus />))
  expect(worker.postMessage).toHaveBeenCalled()
  expect(register).toHaveBeenCalledOnce()
  expect(host.textContent).toBe('')
})

it('does not claim offline readiness when no installed worker exists', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false); getRegistration.mockResolvedValue(null)
  await act(async () => root.render(<OfflineStatus />))
  expect(register).not.toHaveBeenCalled()
  expect(host.textContent).toContain('Offline access is not ready')
})

it('hides the preparation notice only after the active worker confirms a complete cache', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true); register.mockResolvedValue(registration)
  await act(async () => root.render(<OfflineStatus />))
  expect(register).toHaveBeenCalledWith('sw.js', { updateViaCache: 'none' })
  expect(host.textContent).toBe('')
})

it('shows failed precache and provides a retry that can recover', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true); register.mockResolvedValue(registration)
  let ready = false
  worker.postMessage.mockImplementation((_, ports) => ports[0].postMessage({ ready }))
  await act(async () => root.render(<OfflineStatus />))
  expect(host.textContent).toContain('Offline access is not ready')
  ready = true; await act(async () => host.querySelector('button').click())
  expect(host.textContent).toBe(''); expect(registration.update).toHaveBeenCalledOnce()
})

it('does not silently hide registration failure when there is no installed worker', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true); getRegistration.mockResolvedValue(null)
  await act(async () => root.render(<OfflineStatus />))
  expect(host.textContent).toContain('Offline access is not ready')
})

it('bounds a worker that never answers the readiness message', async () => {
  vi.useFakeTimers(); vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  register.mockResolvedValue(registration); worker.postMessage.mockImplementation(() => {})
  await act(async () => root.render(<OfflineStatus />))
  await act(async () => vi.advanceTimersByTimeAsync(6000))
  expect(host.textContent).toContain('Offline access is not ready')
})
