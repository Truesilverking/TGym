// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Slider } from './ui.jsx'
import { ConflictValues } from './RestoreSheet.jsx'
import { setLang } from '../lib/i18n.js'

let root, host
beforeEach(async () => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; await setLang('en'); host = document.createElement('div'); document.body.append(host); root = createRoot(host) })
afterEach(async () => { await act(() => root.unmount()); host.remove(); await setLang('en') })
it('labels the weight slider and supports keyboard bounds', async () => {
  const change = vi.fn()
  await act(() => root.render(<Slider value={60} min={40} max={120} onChange={change} aria-label="Weight" aria-valuetext="60 kg" />))
  const slider = host.querySelector('[role=slider]')
  expect(slider.getAttribute('aria-label')).toBe('Weight')
  expect(slider.getAttribute('aria-valuetext')).toBe('60 kg')
  for (const key of ['Home','End']) await act(() => slider.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })))
  expect(change.mock.calls).toEqual([[40],[120]])
})
it.each([['en','This device','Other device'],['es','Este dispositivo','Otro dispositivo']])('makes both cloud snapshots inspectable in %s', async (lang, local, remote) => {
  await setLang(lang)
  await act(() => root.render(<ConflictValues local={{ name: 'Strength', vol: 100 }} remote={{ name: 'Strength', vol: 150 }} />))
  expect(host.textContent).toContain(local); expect(host.textContent).toContain(remote)
  const snapshots = [...host.querySelectorAll('pre')].map(node => JSON.parse(node.textContent))
  expect(snapshots).toEqual([{ name: 'Strength', vol: 100 },{ name: 'Strength', vol: 150 }])
  expect(host.textContent).not.toContain('[object Object]')
})
