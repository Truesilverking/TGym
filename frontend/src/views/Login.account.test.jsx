// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Login from './Login.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { bindUI } from '../components/ui.jsx'
import { canUndoImport, restoreImportUndo } from '../lib/import-undo.js'

const auth = vi.hoisted(() => ({ api: vi.fn(), register: vi.fn(), login: vi.fn() }))
vi.mock('../lib/api.js', async original => ({ ...await original(), api: auth.api, webauthnOK: () => true, passkeyRegister: auth.register, passkeyLogin: auth.login }))
vi.mock('../lib/demo.js', async original => ({ ...await original(), DEMO: false, STANDALONE: false }))
vi.mock('../lib/i18n.js', async original => ({ ...await original(), t: (key, ...values) => key.replace(/\{(\d+)\}/g, (_, index) => values[index]) }))
let host, root, toast, push, pull, reader, backupData
function App() {
  const sheets = useUI(s => s.sheets)
  return <><Login />{sheets.map(sheet => <div key={sheet.id}>{sheet.render(() => useUI.getState().closeSheet(sheet.id))}</div>)}</>
}
async function click(label) {
  const node = [...host.querySelectorAll('button')].find(node => node.textContent === label)
  expect(node).toBeTruthy()
  await act(async () => node.click())
}
async function enterName() {
  const node = host.querySelector('input[placeholder="Your name"]')
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(node, 'Synthetic')
    node.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  auth.api.mockResolvedValue({ invite_only: false })
  auth.register.mockResolvedValue({ id: 'synthetic', name: 'Synthetic' })
  auth.login.mockResolvedValue({ id: 'synthetic', name: 'Synthetic' })
  toast = vi.fn(); push = vi.fn().mockResolvedValue(true); pull = vi.fn().mockResolvedValue(true)
  vi.spyOn(useStore.getState(), 'pushState').mockImplementation(push)
  vi.spyOn(useStore.getState(), 'pullState').mockImplementation(pull)
  useStore.setState({ user: null, config: { allow_guest: true }, serverSyncError: null, storageWarning: null, S: { ...structuredClone(DEF), lang: 'en' } })
  useUI.setState({ sheets: [], toast })
  bindUI(useUI)
  backupData = { ...structuredClone(DEF), routines: [{ id: 'backup', name: 'Backup', ex: [] }] }
  vi.stubGlobal('FileReader', class { readAsText() { reader = this; this.result = JSON.stringify(backupData) } })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => root.render(<App />))
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
async function selectBackup() {
  const input = host.querySelector('input[type=file]')
  Object.defineProperty(input, 'files', { configurable: true, value: [new File(['synthetic'], 'backup.json')] })
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
  await act(async () => reader.onload())
}
function denyStorageWrite(name, deniedKey) {
  const original = globalThis[name]
  vi.stubGlobal(name, new Proxy(original, { get(target, key) {
    if (key === 'setItem') return (entry, value) => {
      if (entry === deniedKey) throw new DOMException('Synthetic quota', 'QuotaExceededError')
      return target.setItem(entry, value)
    }
    const value = Reflect.get(target, key, target)
    return typeof value === 'function' ? value.bind(target) : value
  } }))
  return () => { globalThis[name] = original }
}

it('requests strict upload after registering and keeps a failed upload out of the success messages', async () => {
  await act(async () => useStore.setState({ S: { ...useStore.getState().S, routines: [{ id: 'local', name: 'Local', ex: [] }] } }))
  push.mockImplementation(({ strict } = {}) => strict ? Promise.reject(new Error('Synthetic upload failure')) : undefined)
  await click('Create new profile'); await enterName(); await click('Create passkey')
  expect(auth.register).toHaveBeenCalledWith('Synthetic', '')
  expect(push).toHaveBeenCalledWith({ strict: true })
  expect(toast).toHaveBeenCalledWith('Synthetic upload failure')
  expect(toast.mock.calls.flat().some(text => text.includes('data from this device moved'))).toBe(false)
  expect(useStore.getState().S.routines[0].id).toBe('local')
})

it('reports failed sign-in synchronization without a welcome success', async () => {
  pull.mockResolvedValue(false)
  await click('Sign in with passkey')
  expect(toast).toHaveBeenCalledWith('Server synchronization failed. Your local data was kept.')
  expect(toast.mock.calls.flat().some(text => text.startsWith('Welcome'))).toBe(false)
})

it('reports failed first download after registration without welcoming an unsynchronized profile', async () => {
  pull.mockResolvedValue(false)
  await click('Create new profile'); await enterName(); await click('Create passkey')
  expect(toast).toHaveBeenCalledWith('Server synchronization failed. Your local data was kept.')
  expect(toast.mock.calls.flat().some(text => text.startsWith('Welcome'))).toBe(false)
})

it('starts only one passkey sign-in when the same button is activated repeatedly', async () => {
  let finish
  auth.login.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const node = [...host.querySelectorAll('button')].find(node => node.textContent === 'Sign in with passkey')
  await act(async () => { node.click(); node.click() })
  expect(auth.login).toHaveBeenCalledOnce()
  await act(async () => { finish({ id: 'synthetic', name: 'Synthetic' }); await Promise.resolve() })
  expect(pull).toHaveBeenCalledOnce()
})

it('does not offer a local backup restore when the server disables guest mode', async () => {
  await act(async () => useStore.setState({ config: { allow_guest: false } }))
  expect(host.textContent).not.toContain('Have a backup? Restore a file')
  expect(host.querySelector('input[type=file]')).toBeNull()
})

it('requires confirmation before replacing a kept local profile and retains an exact Undo snapshot', async () => {
  const existing = { ...structuredClone(DEF), routines: [{ id: 'existing', name: 'Existing', ex: [] }] }
  await act(async () => useStore.getState().replaceState(existing))
  await selectBackup()
  expect(host.textContent).toContain('This replaces all current data with the backup file.')
  expect(useStore.getState().S.routines[0].id).toBe('existing')
  expect(toast).not.toHaveBeenCalledWith('Backup imported')
  await click('Import')
  expect(useStore.getState().S.routines[0].id).toBe('backup')
  expect(canUndoImport()).toBe(true)
  await act(async () => restoreImportUndo(useStore.getState().replaceState))
  expect(useStore.getState().S.routines[0].id).toBe('existing')
})

it('keeps existing data when the restore confirmation is cancelled', async () => {
  await act(async () => useStore.getState().replaceState({ ...structuredClone(DEF), workouts: [{ id: 'existing', entries: [] }] }))
  await selectBackup(); await click('Cancel')
  expect(useStore.getState().S.workouts[0].id).toBe('existing')
  expect(toast).not.toHaveBeenCalledWith('Backup imported')
})

it('does not replace a kept local profile when its Undo snapshot cannot be saved', async () => {
  await act(async () => useStore.getState().replaceState({ ...structuredClone(DEF), routines: [{ id: 'existing', name: 'Existing', ex: [] }] }))
  await selectBackup()
  denyStorageWrite('sessionStorage', 'framegym_last_import_undo_v1')
  await click('Import')
  expect(useStore.getState().S.routines[0].id).toBe('existing')
  expect(toast).toHaveBeenCalledWith('Could not save. Check available storage and try again.')
  expect(toast).not.toHaveBeenCalledWith('Backup imported')
})

it('restores directly into an empty local profile without adding an unnecessary confirmation', async () => {
  await selectBackup()
  expect(useStore.getState().S.routines[0].id).toBe('backup')
  expect(useUI.getState().sheets).toHaveLength(0)
  expect(toast).toHaveBeenCalledWith('Backup imported')
})

it('preserves the current profile on a primary write failure and restores once on retry', async () => {
  await act(async () => useStore.getState().replaceState({ ...structuredClone(DEF), routines: [{ id: 'existing', name: 'Existing', ex: [] }] }))
  const stored = localStorage.getItem('gym_state_v1'), restoreWrites = denyStorageWrite('localStorage', 'gym_state_v1')
  await selectBackup(); await click('Import')
  expect(useStore.getState().S.routines[0].id).toBe('existing')
  expect(localStorage.getItem('gym_state_v1')).toBe(stored)
  expect(toast).not.toHaveBeenCalledWith('Backup imported')
  expect(canUndoImport()).toBe(true)
  restoreWrites()
  await selectBackup(); await click('Import')
  expect(useStore.getState().S.routines.map(r => r.id)).toEqual(['backup'])
  expect(toast.mock.calls.filter(([message]) => message === 'Backup imported')).toHaveLength(1)
})
