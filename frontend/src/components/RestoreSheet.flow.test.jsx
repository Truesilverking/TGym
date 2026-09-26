// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import RestoreSheet from './RestoreSheet.jsx'
import Modals from './Modals.jsx'
import { useStore, DEF } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { setLang, t } from '../lib/i18n.js'
import { mergeTGymStates } from '../lib/state-merge.js'
import { consumeImportUndo } from '../lib/import-undo.js'
import { backupToGoogleDrive, synchronizeWithGoogleDrive } from '../lib/cloud-sync.js'

vi.mock('../lib/cloud-sync.js', () => ({
  nativeDriveAuthAvailable: () => true, configuredGoogleClientId: () => 'test-only',
  connectGoogleDrive: vi.fn(), backupToGoogleDrive: vi.fn(), restoreFromGoogleDrive: vi.fn(),
  synchronizeWithGoogleDrive: vi.fn(), listGoogleDriveBackups: vi.fn(),
}))
let host, root, initial
const reviewed = { id: 'cloud-file', modifiedTime: 'reviewed-version' }
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers(); vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); await setLang('en')
  initial = { ...structuredClone(DEF), lang: 'en', routines: [{ id: 'r', name: 'Local', ex: [] }] }
  useStore.setState({ S: initial, user: null }); useUI.setState({ sheets: [] })
  const remote = structuredClone(initial); remote.routines[0].name = 'Remote'
  synchronizeWithGoogleDrive.mockResolvedValue({ ...mergeTGymStates(initial, remote), file: reviewed })
  backupToGoogleDrive.mockResolvedValue({ fileId: reviewed.id, modifiedTime: 'saved-version', at: Date.now() })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(() => root.render(<><RestoreSheet /><Modals /></>))
})
afterEach(async () => { await act(() => root.unmount()); host.remove(); vi.clearAllTimers(); vi.useRealTimers() })
async function click(text) {
  const target = [...host.querySelectorAll('button')].find(el => el.textContent.trim() === text)
  expect(target).toBeTruthy(); await act(async () => { target.click() })
}

it.each([['Keep changes from this device', 'Local'], ['Use changes from the other device', 'Remote']])('saves the reviewed cloud version with %s and keeps an undo snapshot', async (choice, name) => {
  await click('Synchronize all devices'); await click(choice)
  expect(backupToGoogleDrive).toHaveBeenCalledWith(expect.objectContaining({ routines: [expect.objectContaining({ name })] }), { interactive: false, expectedFile: reviewed })
  expect(useStore.getState().S.cloudSync.lastModifiedTime).toBe('saved-version')
  expect(consumeImportUndo().routines[0].name).toBe('Local')
})
it('does not overwrite a local edit made while the conflict dialog was open', async () => {
  await click('Synchronize all devices')
  await act(() => useStore.getState().update(s => { s.routines[0].name = 'Edited during review' }))
  await click('Use changes from the other device')
  expect(backupToGoogleDrive).not.toHaveBeenCalled()
  expect(useStore.getState().S.routines[0].name).toBe('Edited during review')
  expect(useStore.getState().S.cloudSync.lastError).toBe(t('Local data changed. Please synchronize again.'))
})
