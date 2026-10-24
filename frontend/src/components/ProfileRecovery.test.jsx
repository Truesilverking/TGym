// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ProfileRecovery from './ProfileRecovery.jsx'

const mock = vi.hoisted(() => ({ export: vi.fn(), save: vi.fn(), retry: vi.fn() }))
vi.mock('../store/useStore.js', () => ({ useStore: { getState: () => ({ retryStorage: mock.retry }) } }))
vi.mock('../lib/profile-resources.js', () => ({ exportProfileRecovery: (...args) => mock.export(...args) }))
vi.mock('../lib/report-file.js', () => ({ saveReportFile: (...args) => mock.save(...args) }))
vi.mock('../lib/i18n.js', () => ({ t: (key, ...args) => args.reduce((value, arg, i) => value.replaceAll(`{${i}}`, arg), key) }))
let host, root, error, raw
const button = text => [...host.querySelectorAll('button')].find(el => el.textContent === text)
const render = () => act(() => root.render(<ProfileRecovery error={error} />))
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  raw = JSON.stringify({ _webStorage: { version: 1 }, customEx: [{ id: 'anonymous', img: { $tgymResource: 1, key: 'sha256:anonymous' } }], workouts: [{ id: 'history' }], unit: 'lb' })
  localStorage.setItem('gym_state_v1', raw)
  error = new Error('Resource unavailable', { cause: new DOMException('Storage denied', 'SecurityError') })
  error.diagnostics = { stage: 'resource-read', backend: 'indexedDB', database: 'tgym-profile', store: 'resources', key: 'sha256:anonymous' }
  mock.export.mockReset().mockResolvedValue({ tgym_profile_recovery: 1, rawProfile: raw, resources: [['sha256:anonymous', 'data:image/png;base64,anonymized']], unavailable: ['sha256:missing'], storageError: null })
  mock.save.mockReset().mockResolvedValue(undefined); mock.retry.mockReset().mockResolvedValue(undefined)
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove(); localStorage.clear() })

it('prepares a recovery bundle preserving raw references and readable resources, then downloads from a direct action', async () => {
  render(); await act(async () => button('Export saved data').click())
  expect(mock.export).toHaveBeenCalledExactlyOnceWith(raw); expect(mock.save).not.toHaveBeenCalled()
  expect(host.textContent).toContain('cannot be imported as a normal TGym backup')
  expect(host.querySelector('[role="status"]').textContent).toBe('Recovery bundle prepared: 1 resources included · 1 unavailable.')
  await act(async () => button('Download recovery bundle').click())
  expect(mock.save).toHaveBeenCalledOnce()
  const file = mock.save.mock.calls[0][0], bundle = JSON.parse(await file.blob.text())
  expect(file.name).toBe('TGym-profile-recovery.json')
  expect(bundle).toMatchObject({ tgym_profile_recovery: 1, rawProfile: raw, resources: [['sha256:anonymous', 'data:image/png;base64,anonymized']], unavailable: ['sha256:missing'] })
  expect(localStorage.getItem('gym_state_v1')).toBe(raw)
  expect(host.querySelector('.profile-recovery-diagnostics').open).toBe(false)
  expect(host.querySelector('.profile-recovery-diagnostics').textContent).not.toContain('data:image')
})

it('blocks duplicate recovery exports until resource reads finish', async () => {
  let finish; mock.export.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  render(); act(() => { button('Export saved data').click(); button('Export saved data').click() })
  expect(mock.export).toHaveBeenCalledOnce(); expect(button('Retry loading saved data').disabled).toBe(true)
  expect(button('Download recovery bundle')).toBeUndefined()
  await act(async () => finish({ tgym_profile_recovery: 1, rawProfile: raw, resources: [], unavailable: ['sha256:anonymous'] }))
  expect(button('Download recovery bundle').disabled).toBe(false); expect(localStorage.getItem('gym_state_v1')).toBe(raw)
})

it('keeps a prepared bundle retryable after download failure without rereading or overwriting the profile', async () => {
  mock.save.mockRejectedValueOnce(new DOMException('Download denied', 'NotAllowedError'))
  render(); await act(async () => button('Export saved data').click()); await act(async () => button('Download recovery bundle').click())
  expect(host.querySelector('[role="alert"]').textContent).toContain('Your saved data was kept')
  expect(button('Download recovery bundle').disabled).toBe(false)
  await act(async () => button('Download recovery bundle').click())
  expect(mock.save).toHaveBeenCalledTimes(2); expect(mock.export).toHaveBeenCalledOnce(); expect(localStorage.getItem('gym_state_v1')).toBe(raw)
})

it('retries through the store recovery transaction and prevents a second retry while pending', async () => {
  let finish; mock.retry.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  render(); act(() => { button('Retry loading saved data').click(); button('Retry loading saved data').click() })
  expect(mock.retry).toHaveBeenCalledOnce(); expect(button('Export saved data').disabled).toBe(true)
  await act(async () => finish())
  expect(button('Export saved data').disabled).toBe(false); expect(localStorage.getItem('gym_state_v1')).toBe(raw)
})

it('preserves the source when preparation fails instead of exporting an empty replacement', async () => {
  mock.export.mockRejectedValueOnce(new DOMException('Storage denied', 'SecurityError'))
  render(); await act(async () => button('Export saved data').click())
  expect(button('Download recovery bundle')).toBeUndefined(); expect(mock.save).not.toHaveBeenCalled()
  expect(host.querySelector('[role="alert"]').textContent).toContain('Your saved data was kept')
  expect(localStorage.getItem('gym_state_v1')).toBe(raw)
})
