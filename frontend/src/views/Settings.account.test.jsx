// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Settings from './Settings.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { bindUI } from '../components/ui.jsx'

const auth = vi.hoisted(() => ({ api: vi.fn(), register: vi.fn(), login: vi.fn() }))
vi.mock('../lib/api.js', async original => ({ ...await original(), api: auth.api, webauthnOK: () => true, passkeyRegister: auth.register, passkeyLogin: auth.login }))
vi.mock('../lib/mobile.js', async original => ({ ...await original(), MOBILE: false }))
vi.mock('../lib/demo.js', async original => ({ ...await original(), DEMO: false, STANDALONE: false }))
vi.mock('../lib/i18n.js', async original => ({ ...await original(), t: (key, ...values) => key.replace(/\{(\d+)\}/g, (_, index) => values[index]) }))
vi.mock('../components/AppUpdate.jsx', () => ({ UpdateCheckButton: () => null }))
let host, root, toast, push, pull
function App() {
  const sheets = useUI(s => s.sheets)
  return <MemoryRouter><Settings />{sheets.map(sheet => <div key={sheet.id}>{sheet.render(() => useUI.getState().closeSheet(sheet.id))}</div>)}</MemoryRouter>
}
async function click(text) {
  const node = [...host.querySelectorAll('button,[role=button]')].find(node => node.textContent === text || node.querySelector('.lrow-t')?.textContent === text)
  expect(node).toBeTruthy()
  await act(async () => node.click())
}
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.clearAllMocks()
  localStorage.clear(); sessionStorage.clear()
  auth.api.mockResolvedValue({ invite_only: false })
  auth.register.mockResolvedValue({ id: 'synthetic', name: 'Synthetic' })
  auth.login.mockResolvedValue({ id: 'synthetic', name: 'Synthetic' })
  toast = vi.fn(); push = vi.fn().mockResolvedValue(true); pull = vi.fn().mockResolvedValue(true)
  vi.spyOn(useStore.getState(), 'pushState').mockImplementation(push)
  vi.spyOn(useStore.getState(), 'pullState').mockImplementation(pull)
  useStore.setState({ user: null, serverSyncError: null, storageWarning: null, S: { ...structuredClone(DEF), lang: 'en' } })
  useUI.setState({ sheets: [], toast, settingsDeloadExpanded: false, settingsDeloadDateDraft: undefined })
  bindUI(useUI)
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => root.render(<App />))
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks() })

it('renders the existing profile form and reports upload failure instead of claiming data was moved', async () => {
  useStore.setState({ S: { ...useStore.getState().S, routines: [{ id: 'local-routine', name: 'Local', ex: [] }] } })
  push.mockRejectedValue(new Error('Synthetic upload failure'))
  await click('Create passkey profile')
  const name = host.querySelector('input[placeholder="Your name"]')
  expect(name).toBeTruthy()
  name.value = 'Synthetic'
  await click('Create passkey')
  expect(auth.register).toHaveBeenCalledWith('Synthetic', '')
  expect(push).toHaveBeenCalledWith({ strict: true })
  expect(toast).toHaveBeenCalledWith('Synthetic upload failure')
  expect(toast.mock.calls.flat().some(value => value.includes('data moved'))).toBe(false)
  expect(useStore.getState().S.routines[0].id).toBe('local-routine')
})

it('shows a failed initial sign-in sync without a welcome success message', async () => {
  pull.mockResolvedValue(false)
  await click('Sign in with passkey')
  expect(pull).toHaveBeenCalledOnce()
  expect(toast).toHaveBeenCalledWith('Server synchronization failed. Your local data was kept.')
  expect(toast.mock.calls.flat().some(value => value.startsWith('Welcome'))).toBe(false)
})

it('keeps Data privacy first and guards repeated retries while a failed sync is pending', async () => {
  let finish
  pull.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  await act(async () => useStore.setState({ user: { id: 'synthetic', name: 'Synthetic' }, serverSyncError: 'Server synchronization failed. Your local data was kept.' }))
  const data = [...host.querySelectorAll('section.sect')].find(node => node.querySelector('h2')?.textContent === 'Data')
  expect(data.querySelector('.sect-b').firstElementChild.querySelector('.lrow-t').textContent).toBe('All Data stays on this device')
  expect(data.querySelector('[role=alert]').textContent).toContain('Your local data was kept.')
  await click('Sync now')
  await click('Sync now')
  expect(pull).toHaveBeenCalledOnce()
  await act(async () => { finish(false); await Promise.resolve() })
  expect(data.querySelector('[role=alert]')).toBeTruthy()
})
