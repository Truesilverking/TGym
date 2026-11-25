import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const bridge = vi.hoisted(() => ({ native: false, addListener: vi.fn(), getState: vi.fn() }))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => bridge.native } }))
vi.mock('@capacitor/app', () => ({ App: bridge }))
import { observeAppVisibility } from './app-visibility.js'

let doc, listeners, nativeEvent, remove, disposers
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const settle = async () => { await vi.dynamicImportSettled(); await Promise.resolve(); await Promise.resolve() }
const observe = callback => { const dispose = observeAppVisibility(callback); disposers.push(dispose); return dispose }
const documentState = hidden => { doc.hidden = hidden; for (const listener of [...listeners]) listener() }
beforeEach(() => {
  vi.resetAllMocks(); bridge.native = false; listeners = new Set(); disposers = []; nativeEvent = null
  doc = { hidden: false, addEventListener: vi.fn((type, listener) => { if (type === 'visibilitychange') listeners.add(listener) }), removeEventListener: vi.fn((type, listener) => listeners.delete(listener)) }
  vi.stubGlobal('document', doc)
  remove = vi.fn(async () => {})
  bridge.addListener.mockImplementation((type, listener) => { expect(type).toBe('appStateChange'); nativeEvent = listener; return Promise.resolve({ remove }) })
  bridge.getState.mockResolvedValue({ isActive: true })
})
afterEach(async () => { for (const dispose of disposers) dispose(); await settle(); vi.unstubAllGlobals() })

it('uses document transitions only in browsers and returns a synchronous idempotent disposer', async () => {
  const callback = vi.fn(), dispose = observe(callback)
  expect(typeof dispose).toBe('function'); expect(callback).not.toHaveBeenCalled()
  documentState(true); documentState(true); documentState(false); documentState(false)
  expect(callback.mock.calls).toEqual([[false], [true]])
  dispose(); dispose(); documentState(true); await settle()
  expect(callback).toHaveBeenCalledTimes(2); expect(listeners.size).toBe(0); expect(bridge.addListener).not.toHaveBeenCalled()
})
it('immediately publishes an initially hidden document without an initial visible notification', () => {
  doc.hidden = true; const callback = vi.fn(); observe(callback)
  expect(callback.mock.calls).toEqual([[false]])
  documentState(true); expect(callback).toHaveBeenCalledTimes(1)
})
it('reports native-only background even while the WebView stays visible and deduplicates both sources', async () => {
  bridge.native = true; const callback = vi.fn(); observe(callback); await settle()
  nativeEvent({ isActive: false }); nativeEvent({ isActive: false }); documentState(false)
  expect(callback.mock.calls).toEqual([[false]])
  documentState(true); nativeEvent({ isActive: true }); expect(callback).toHaveBeenCalledTimes(1)
  documentState(false); expect(callback.mock.calls).toEqual([[false], [true]])
})
it('keeps native inactivity authoritative until its own resume event', async () => {
  bridge.native = true; const callback = vi.fn(); observe(callback); await settle()
  documentState(true); nativeEvent({ isActive: false }); documentState(false)
  expect(callback.mock.calls).toEqual([[false]])
  nativeEvent({ isActive: true }); nativeEvent({ isActive: true })
  expect(callback.mock.calls).toEqual([[false], [true]])
})
it('uses a native inactive snapshot when no newer event has arrived', async () => {
  bridge.native = true; bridge.getState.mockResolvedValue({ isActive: false })
  const callback = vi.fn(); observe(callback); await settle()
  expect(callback.mock.calls).toEqual([[false]])
  nativeEvent({ isActive: true }); expect(callback.mock.calls).toEqual([[false], [true]])
})
it.each([[false, true], [true, false]])('does not replace a newer native event %s with late snapshot %s', async (eventActive, snapshotActive) => {
  bridge.native = true; const snapshot = deferred(); bridge.getState.mockReturnValue(snapshot.promise)
  const callback = vi.fn(); observe(callback); await settle(); nativeEvent({ isActive: eventActive })
  snapshot.resolve({ isActive: snapshotActive }); await settle()
  expect(callback.mock.calls).toEqual(eventActive ? [] : [[false]])
})
it('disposes a native handle that resolves after synchronous disposal and ignores late results', async () => {
  bridge.native = true; const handle = deferred(), snapshot = deferred()
  bridge.addListener.mockImplementation((type, listener) => { nativeEvent = listener; return handle.promise }); bridge.getState.mockReturnValue(snapshot.promise)
  const callback = vi.fn(), dispose = observe(callback); await settle(); dispose()
  nativeEvent({ isActive: false }); snapshot.resolve({ isActive: false }); handle.resolve({ remove }); await settle()
  expect(callback).not.toHaveBeenCalled(); expect(remove).toHaveBeenCalledOnce(); expect(listeners.size).toBe(0)
})
it('does not subscribe when disposed before the dynamic native import resolves', async () => {
  bridge.native = true; const callback = vi.fn(), dispose = observe(callback); dispose(); await settle()
  expect(bridge.addListener).not.toHaveBeenCalled(); expect(bridge.getState).not.toHaveBeenCalled(); expect(callback).not.toHaveBeenCalled()
})
it('absorbs asynchronous removal failures and native setup failures while retaining document behavior', async () => {
  bridge.native = true; remove.mockRejectedValue(new Error('bridge closed')); bridge.getState.mockRejectedValue(new Error('snapshot unavailable'))
  const callback = vi.fn(), dispose = observe(callback); await settle(); documentState(true); dispose(); await settle()
  expect(remove).toHaveBeenCalledOnce(); expect(callback.mock.calls).toEqual([[false]])
})
it('falls back to document visibility when subscription throws despite an inactive native snapshot', async () => {
  bridge.native = true; bridge.addListener.mockImplementation(() => { throw Error('unavailable') }); bridge.getState.mockResolvedValue({ isActive: false })
  const callback = vi.fn(); observe(callback); await settle(); expect(callback).not.toHaveBeenCalled()
  documentState(true); documentState(false)
  expect(callback.mock.calls).toEqual([[false], [true]])
})
it('releases an inactive native snapshot if the pending subscription rejects and has no resume channel', async () => {
  bridge.native = true; const handle = deferred()
  bridge.addListener.mockImplementation((type, listener) => { nativeEvent = listener; return handle.promise }); bridge.getState.mockResolvedValue({ isActive: false })
  const callback = vi.fn(); observe(callback); await settle(); expect(callback.mock.calls).toEqual([[false]])
  handle.reject(Error('subscription unavailable')); await settle()
  expect(callback.mock.calls).toEqual([[false], [true]])
  nativeEvent({ isActive: false }); expect(callback).toHaveBeenCalledTimes(2)
  documentState(true); documentState(false); expect(callback.mock.calls).toEqual([[false], [true], [false], [true]])
})
it('ignores an inactive snapshot that arrives after subscription failure', async () => {
  bridge.native = true; const handle = deferred(), snapshot = deferred()
  bridge.addListener.mockReturnValue(handle.promise); bridge.getState.mockReturnValue(snapshot.promise)
  const callback = vi.fn(); observe(callback); await settle()
  handle.reject(Error('subscription unavailable')); await settle(); snapshot.resolve({ isActive: false }); await settle()
  expect(callback).not.toHaveBeenCalled(); documentState(true); documentState(false)
  expect(callback.mock.calls).toEqual([[false], [true]])
})
it('safely skips SSR without a document or native subscriptions', async () => {
  vi.stubGlobal('document', undefined); bridge.native = true; const callback = vi.fn(), dispose = observe(callback)
  dispose(); await settle(); expect(callback).not.toHaveBeenCalled(); expect(bridge.addListener).not.toHaveBeenCalled()
})
