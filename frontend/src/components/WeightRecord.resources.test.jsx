// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { bwSheet } from '../sheets.jsx'
import { hydrateProfile, retainProfileResources } from '../lib/profile-resources.js'
import { setLang } from '../lib/i18n.js'
import { todayISO } from '../lib/format.js'

vi.mock('../lib/demo.js', () => ({ STANDALONE: true, DEMO: false, DEMO_SEEDED: 'test' }))
const KEY = 'gym_state_v1'
let host, root, stores, failResources, before, raw, quota, storage

function profileDatabase() {
  stores = { resources: new Map(), snapshots: new Map() }
  const db = { close() {}, transaction(name, mode) {
    const staged = new Map(stores[name]); let failed = false
    const tx = { error: null, abort() { failed = true; queueMicrotask(() => tx.onabort?.()) }, objectStore: () => ({
      put(value, key) {
        const request = { error: null }
        queueMicrotask(() => {
          if (failed) return
          if (name === 'resources' && failResources) {
            failed = true; request.error = tx.error = new DOMException('Synthetic resource failure', 'QuotaExceededError')
            request.onerror?.(); tx.onerror?.()
          } else staged.set(key, structuredClone(value))
        })
        return request
      },
      get(key) { const request = {}; queueMicrotask(() => { request.result = stores[name].get(key); request.onsuccess?.() }); return request },
    }) }
    queueMicrotask(() => queueMicrotask(() => { if (!failed) { if (mode === 'readwrite') stores[name] = staged; tx.oncomplete?.() } }))
    return tx
  } }
  vi.stubGlobal('indexedDB', { open() { const request = { result: db }; queueMicrotask(() => request.onsuccess?.()); return request } })
}
function Sheets() { return useUI(s => s.sheets).map(sheet => <div key={sheet.id}>{sheet.render(() => useUI.getState().closeSheet(sheet.id))}</div>) }
const save = async () => act(async () => {
  const button = [...host.querySelectorAll('button')].find(node => node.textContent === 'Save')
  useUI.setState({ toastMsg: '' })
  button.click()
  await vi.waitFor(() => expect(useUI.getState().sheets.length === 0 || useUI.getState().toastMsg !== '').toBe(true), { timeout: 2000 })
})

beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.stubGlobal('crypto', webcrypto); profileDatabase(); failResources = false; retainProfileResources({})
  localStorage.clear(); await setLang('en')
  before = { ...structuredClone(DEF), lang: 'en', hasCompletedOnboarding: true, hasCompletedAppTour: true,
    customEx: [{ id: 'saved-media', n: 'Saved custom exercise', custom: true, img: 'data:image/gif;base64,' + 'A'.repeat(65536) }],
    routines: [{ id: 'keep-routine', name: 'Keep', ex: [] }], workouts: [{ id: 'keep-history', entries: [] }], _ts: 1 }
  raw = JSON.stringify(before); localStorage.setItem(KEY, raw); quota = raw.length + 80
  storage = localStorage
  vi.stubGlobal('localStorage', new Proxy(storage, { get(target, key) {
    if (key === 'setItem') return (name, value) => {
      if (name === KEY && value.length > quota) throw new DOMException('Synthetic full primary store', 'QuotaExceededError')
      return target.setItem(name, value)
    }
    const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value
  } }))
  useStore.setState({ S: structuredClone(before), user: null, storageError: null, storageWarning: null })
  useUI.setState({ sheets: [], timer: null, work: null, toastMsg: '' })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => { root.render(<Sheets />); bwSheet() })
  await act(() => {
    const input = host.querySelector('.bodyweight-picker input'); input.focus()
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '80,5')
    input.dispatchEvent(new Event('input', { bubbles: true })); input.blur()
  })
})
afterEach(async () => {
  await useStore.getState().flushPersistence(); await act(() => root.unmount()); host.remove(); useUI.getState().closeAll()
  vi.restoreAllMocks(); vi.unstubAllGlobals(); retainProfileResources({})
})

it('saves a weight into a full PWA profile by committing verified media references first', async () => {
  await save()
  expect(useUI.getState().sheets).toHaveLength(0)
  const state = useStore.getState().S
  expect(state.bodyweight).toEqual([expect.objectContaining({ d: todayISO(), w: 80.5, samples: [expect.objectContaining({ w: 80.5 })] })])
  for (const key of ['routines', 'workouts', 'customEx', 'unit', 'lang']) expect(state[key]).toEqual(before[key])
  const core = JSON.parse(localStorage.getItem(KEY))
  expect(core._webStorage).toEqual({ version: 1 }); expect(localStorage.getItem(KEY).length).toBeLessThan(raw.length / 2)
  expect(await hydrateProfile(core)).toEqual(state)
  await useStore.getState().flushPersistence()
  expect(await hydrateProfile(stores.snapshots.get('current'))).toEqual(state)
})

it('retains the previous profile and editable weight after a resource failure, then retries once', async () => {
  failResources = true; await save()
  expect(localStorage.getItem(KEY)).toBe(raw); expect(useStore.getState().S).toEqual(before)
  expect(useUI.getState().sheets).toHaveLength(1)
  expect(host.querySelector('.bodyweight-picker input').value.replace(',', '.')).toBe('80.5')
  expect(useUI.getState().toastMsg).not.toBe('Weight saved')
  failResources = false; await save()
  expect(useUI.getState().sheets).toHaveLength(0)
  expect(useStore.getState().S.bodyweight).toHaveLength(1)
  expect(useStore.getState().S.bodyweight[0].samples).toHaveLength(1)
  expect(useStore.getState().S.customEx).toEqual(before.customEx)
})
