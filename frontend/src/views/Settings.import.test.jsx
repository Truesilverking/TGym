// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Settings from './Settings.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { bindUI } from '../components/ui.jsx'
import { canUndoImport, restoreImportUndo, saveImportUndo } from '../lib/import-undo.js'

vi.mock('../lib/mobile.js', async original => ({ ...await original(), MOBILE: false }))
vi.mock('../lib/demo.js', async original => ({ ...await original(), DEMO: false, STANDALONE: false }))
vi.mock('../lib/i18n.js', async original => ({ ...await original(), t: key => key }))
vi.mock('../components/AppUpdate.jsx', () => ({ UpdateCheckButton: () => null }))
let host, root, toast, before, imported
function App() {
  const sheets = useUI(s => s.sheets)
  return <MemoryRouter><Settings />{sheets.map(sheet => <div key={sheet.id}>{sheet.render(() => useUI.getState().closeSheet(sheet.id))}</div>)}</MemoryRouter>
}
async function click(text) {
  const nodes = [...host.querySelectorAll('button,[role=button]')]
  const node = nodes.find(node => node.textContent === text) || nodes.find(node => node.querySelector('.lrow-t')?.textContent === text)
  expect(node).toBeTruthy()
  await act(async () => node.click())
}
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers(); localStorage.clear(); sessionStorage.clear()
  before = { ...structuredClone(DEF), lang: 'en', routines: [{ id: 'before', name: 'Before import', ex: [] }] }
  imported = { ...structuredClone(DEF), lang: 'en', routines: [{ id: 'after', name: 'After import', ex: [] }] }
  saveImportUndo(before)
  useStore.setState({ S: imported, user: null, storageError: null, storageWarning: null })
  useStore.getState().replaceState(imported)
  toast = vi.fn(); useUI.setState({ sheets: [], toast }); bindUI(useUI)
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => root.render(<App />))
})
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllTimers(); vi.useRealTimers()
})

it('retains Undo after an actual primary storage quota failure, then restores exactly once on retry', async () => {
  await click('Undo last import')
  const current = localStorage.getItem('gym_state_v1')
  const setItem = localStorage.setItem.bind(localStorage)
  const failing = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
    if (key === 'gym_state_v1') throw new DOMException('Synthetic quota', 'QuotaExceededError')
    return setItem(key, value)
  })
  await click('Restore')
  expect(canUndoImport()).toBe(true)
  expect(useStore.getState().S.routines[0].id).toBe('after')
  expect(localStorage.getItem('gym_state_v1')).toBe(current)
  expect(toast).toHaveBeenCalledWith('Could not save. Check available storage and try again.')
  expect(toast).not.toHaveBeenCalledWith('Import undone')
  failing.mockRestore()
  await click('Undo last import'); await click('Restore')
  expect(useStore.getState().S.routines[0].id).toBe('before')
  expect(JSON.parse(localStorage.getItem('gym_state_v1')).routines[0].id).toBe('before')
  expect(canUndoImport()).toBe(false)
  expect(toast.mock.calls.filter(([text]) => text === 'Import undone')).toHaveLength(1)
})

it('canceling Undo preserves the current profile and its recovery snapshot', async () => {
  await click('Undo last import'); await click('Cancel')
  expect(useStore.getState().S.routines[0].id).toBe('after')
  expect(canUndoImport()).toBe(true)
  expect(toast).not.toHaveBeenCalled()
})

async function chooseBackup() {
  const incoming = { ...structuredClone(DEF), routines: [{ id: 'incoming', name: 'Incoming backup', ex: [] }] }
  vi.stubGlobal('FileReader', class { readAsText() { this.result = JSON.stringify(incoming); this.onload() } })
  const input = host.querySelector('input[type=file][accept=".json,application/json"]')
  Object.defineProperty(input, 'files', { configurable: true, value: [new File(['synthetic'], 'backup.json')] })
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
}
function denyWrite(name, deniedKey) {
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

it('snapshots the profile current at import confirmation instead of the stale file-open render', async () => {
  await chooseBackup()
  await act(async () => useStore.getState().update(s => { s.routines[0].name = 'Latest legitimate edit' }))
  await click('Import')
  expect(useStore.getState().S.routines[0].id).toBe('incoming')
  await act(async () => restoreImportUndo(useStore.getState().replaceState))
  expect(useStore.getState().S.routines[0].name).toBe('Latest legitimate edit')
})

it('keeps the profile and reports failure when the pre-import Undo cannot be saved', async () => {
  await chooseBackup()
  const current = localStorage.getItem('gym_state_v1')
  denyWrite('sessionStorage', 'framegym_last_import_undo_v1')
  await click('Import')
  expect(localStorage.getItem('gym_state_v1')).toBe(current)
  expect(useStore.getState().S.routines[0].id).toBe('after')
  expect(toast).not.toHaveBeenCalledWith('Backup imported')
  expect(toast).toHaveBeenCalledWith('Could not save. Check available storage and try again.')
})

it('preserves the profile and pre-import Undo after a primary failure, then imports once on retry', async () => {
  await chooseBackup()
  const current = localStorage.getItem('gym_state_v1'), restoreWrites = denyWrite('localStorage', 'gym_state_v1')
  await click('Import')
  expect(localStorage.getItem('gym_state_v1')).toBe(current)
  expect(canUndoImport()).toBe(true)
  expect(toast).not.toHaveBeenCalledWith('Backup imported')
  restoreWrites()
  await chooseBackup(); await click('Import')
  expect(useStore.getState().S.routines.map(r => r.id)).toEqual(['incoming'])
  expect(toast.mock.calls.filter(([message]) => message === 'Backup imported')).toHaveLength(1)
})
