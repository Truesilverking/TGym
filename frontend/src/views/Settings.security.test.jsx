// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Settings from './Settings.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { bindUI } from '../components/ui.jsx'

const lock = vi.hoisted(() => ({ create: vi.fn(), verify: vi.fn(), enabled: false }))
vi.mock('../lib/app-lock.js', async original => ({ ...await original(), deviceLockEnabled: () => lock.enabled, biometricEnabled: () => false, setDevicePin: lock.create, verifyDevicePin: lock.verify }))
vi.mock('../lib/mobile.js', async original => ({ ...await original(), MOBILE: false }))
vi.mock('../lib/demo.js', async original => ({ ...await original(), DEMO: false, STANDALONE: false }))
vi.mock('../lib/i18n.js', async original => ({ ...await original(), t: key => key }))
vi.mock('../components/AppUpdate.jsx', () => ({ UpdateCheckButton: () => null }))
let host, root
function App() {
  const sheets = useUI(s => s.sheets)
  return <MemoryRouter><Settings />{sheets.map(sheet => <div key={sheet.id} role="dialog">{sheet.render(() => useUI.getState().closeSheet(sheet.id))}</div>)}</MemoryRouter>
}
const row = label => [...host.querySelectorAll('.lrow')].find(el => el.querySelector('.lrow-t')?.textContent === label)
async function click(label) { const node = [...host.querySelectorAll('button')].find(el => el.textContent === label); expect(node).toBeTruthy(); await act(async () => node.click()) }
async function type(placeholder, value) {
  const node = host.querySelector(`input[placeholder="${placeholder}"]`)
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(node, value); node.dispatchEvent(new Event('input', { bubbles: true })) })
}
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true; localStorage.clear(); sessionStorage.clear(); vi.clearAllMocks()
  lock.enabled = false; lock.create.mockResolvedValue('AAAA-BBBB-CCCC-DDDD'); lock.verify.mockResolvedValue({ ok: false })
  useStore.setState({ user: null, S: { ...structuredClone(DEF), lang: 'en' }, storageWarning: null })
  useUI.setState({ sheets: [], toast: vi.fn() }); bindUI(useUI)
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => root.render(<App />))
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks() })

it('creates a PIN once and keeps its recovery sheet protected while the durable write is pending', async () => {
  let finish
  lock.create.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  await act(async () => row('App lock').click())
  await type('4-digit PIN', '1234'); await type('Repeat PIN', '1234')
  const save = [...host.querySelectorAll('button')].find(el => el.textContent === 'Save')
  await act(async () => { save.click(); save.click() })
  expect(lock.create).toHaveBeenCalledOnce()
  expect(useUI.getState().sheets.at(-1).locked).toBe(true)
  await act(async () => finish('AAAA-BBBB-CCCC-DDDD'))
  expect(host.textContent).toContain('AAAA-BBBB-CCCC-DDDD')
  expect(useUI.getState().sheets.at(-1).locked).toBe(false)
})

it('reports a failed PIN write in the open form and allows a successful retry', async () => {
  lock.create.mockRejectedValueOnce(new Error('Synthetic storage unavailable')).mockResolvedValueOnce('AAAA-BBBB-CCCC-DDDD')
  await act(async () => row('App lock').click())
  await type('4-digit PIN', '1234'); await type('Repeat PIN', '1234')
  await click('Save')
  expect(host.textContent).toContain('Could not save. Check available storage and try again.')
  expect(host.textContent).not.toContain('Save your recovery key')
  expect(document.activeElement).toBe(host.querySelector('input[placeholder="4-digit PIN"]'))
  await click('Save')
  expect(host.textContent).toContain('AAAA-BBBB-CCCC-DDDD')
})

it('verifies once while pending and reports a verification storage failure without running the protected action', async () => {
  lock.enabled = true
  await act(async () => root.render(<App key="locked" />))
  let fail
  lock.verify.mockImplementation(() => new Promise((resolve, reject) => { fail = reject }))
  await act(async () => row('Reset everything').click())
  await type('4-digit PIN', '1234')
  const confirm = [...host.querySelectorAll('button')].find(el => el.textContent === 'Confirm')
  await act(async () => { confirm.click(); confirm.click() })
  expect(lock.verify).toHaveBeenCalledOnce()
  expect(useUI.getState().sheets.at(-1).locked).toBe(true)
  await act(async () => fail(new Error('Synthetic storage read failure')))
  expect(host.textContent).toContain('Could not unlock. Try again.')
  expect(host.textContent).not.toContain('Deletes your plan, workouts and body weight on this device.')
  expect(useUI.getState().sheets.at(-1).locked).toBe(false)
  expect(document.activeElement).toBe(host.querySelector('input[placeholder="4-digit PIN"]'))
})
