// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Settings from './Settings.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'

const player = vi.hoisted(() => ({ launch: vi.fn() }))
vi.mock('../lib/spotifree-sync.js', async original => ({ ...await original(), launchSpotifree: player.launch }))
vi.mock('../lib/mobile.js', async original => ({ ...await original(), MOBILE: false }))
vi.mock('../lib/demo.js', async original => ({ ...await original(), DEMO: false, STANDALONE: false }))
vi.mock('../lib/i18n.js', async original => ({ ...await original(), t: key => key }))
vi.mock('../components/AppUpdate.jsx', () => ({ UpdateCheckButton: () => null }))
let host, root, toast
const row = title => [...host.querySelectorAll('.lrow')].find(node => node.querySelector('.lrow-t')?.textContent === title)
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true; localStorage.clear(); vi.clearAllMocks()
  player.launch.mockResolvedValue(false); toast = vi.fn()
  useStore.setState({ user: null, S: { ...structuredClone(DEF), lang: 'en' }, storageWarning: null })
  useUI.setState({ sheets: [], toast, timer: null })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => root.render(<MemoryRouter><Settings /></MemoryRouter>))
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('explains the external synchronization limit without promising music ducking or a chime', () => {
  expect(row('Spotifree Integration').textContent).toContain('External app sync is not available.')
  expect(row('Spotifree Integration').textContent).not.toContain('ducks music volume')
})

it('starts one launch request and reports unavailable playback instead of silent success', async () => {
  let finish
  player.launch.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const open = row('Open Spotifree')
  await act(async () => { open.click(); open.click() })
  expect(player.launch).toHaveBeenCalledOnce()
  await act(async () => finish(false))
  expect(toast).toHaveBeenCalledWith('The music player could not be opened.')
  player.launch.mockResolvedValue(true)
  await act(async () => open.click())
  expect(player.launch).toHaveBeenCalledTimes(2)
  expect(toast).toHaveBeenCalledTimes(1)
})

it('keeps the saved preference and TGym timer when opting out cannot persist', async () => {
  const timer = { left: 30, total: 30, endsAt: Date.now() + 30000 }
  useUI.setState({ timer })
  const storage = localStorage
  vi.stubGlobal('localStorage', new Proxy(storage, { get(target, key) {
    if (key === 'setItem') return (name, value) => { if (name === 'gym_state_v1') throw new DOMException('Synthetic quota', 'QuotaExceededError'); return target.setItem(name, value) }
    const value = Reflect.get(target, key, target)
    return typeof value === 'function' ? value.bind(target) : value
  } }))
  await act(async () => row('Spotifree Integration').querySelector('[role=switch]').click())
  expect(useStore.getState().S.enableSpotifreeSync).toBe(true)
  expect(useUI.getState().timer).toEqual(timer)
  expect(toast).toHaveBeenCalledWith('Could not save. Check available storage and try again.')
  globalThis.localStorage = storage
  await act(async () => row('Spotifree Integration').querySelector('[role=switch]').click())
  expect(useStore.getState().S.enableSpotifreeSync).toBe(false)
  expect(useUI.getState().timer).toEqual(timer)
})
