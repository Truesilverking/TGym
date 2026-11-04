// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import MobileOnboarding from './MobileOnboarding.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { GUIDED_PLANS } from '../lib/guided-plans.js'
vi.mock('../lib/i18n.js', async original => ({ ...await original(), t: key => key }))
let host, root
const button = label => [...host.querySelectorAll('button')].find(node => node.textContent === label)
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true; localStorage.clear()
  useStore.setState({ S: { ...structuredClone(DEF), lang: 'en' }, user: null })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => root.render(<MobileOnboarding />))
  for (let step = 0; step < 3; step++) await act(async () => button('Continue').click())
})
afterEach(async () => { await act(async () => root.unmount()); host.remove() })

it('exposes every starting choice as a native keyboard button and preserves the profile when starting from scratch', async () => {
  const before = structuredClone(useStore.getState().S), choices = [...host.querySelectorAll('.list .item')]
  expect(choices).toHaveLength(GUIDED_PLANS.length + 2)
  for (const choice of choices) { expect(choice.tagName).toBe('BUTTON'); expect(choice.type).toBe('button'); expect(choice.tabIndex).toBe(0) }
  const scratch = choices.find(node => node.textContent === 'Create from scratch')
  await act(async () => scratch.click())
  expect(host.textContent).toContain('Default rest')
  expect(useStore.getState().S).toEqual(before)
})
