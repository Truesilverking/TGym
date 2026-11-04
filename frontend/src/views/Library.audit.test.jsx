// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Library from './Library.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { registerCustom } from '../lib/exercises.js'
import { setLang } from '../lib/i18n.js'
import { addToRoutineSheet, customExSheet, exerciseDetailSheet } from '../sheets.jsx'

vi.mock('../sheets.jsx', () => ({ addToRoutineSheet: vi.fn(), customExSheet: vi.fn(), exerciseDetailSheet: vi.fn() }))
vi.mock('../components/Media.jsx', () => ({ Thumb: () => null }))
let root, host
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  await setLang('en'); localStorage.clear(); vi.clearAllMocks()
  const S = structuredClone(DEF)
  S.customEx = [{ id: 'keyboard-exercise', n: 'Keyboard exercise', bp: 'chest', eq: 'custom', custom: true }]
  registerCustom(S.customEx)
  useStore.setState({ S, user: null })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(() => root.render(<Library />))
})
afterEach(async () => { await act(() => root.unmount()); host.remove(); registerCustom([]) })

it('offers native keyboard controls for creating and inspecting catalogue exercises', async () => {
  const create = host.querySelector('button.item')
  expect(create).not.toBeNull()
  expect(create.textContent).toContain('Create your own exercise')
  await act(() => create.click())
  expect(customExSheet).toHaveBeenCalledOnce()
  const details = host.querySelector('button.library-exercise-open')
  expect(details).not.toBeNull()
  expect(details.querySelector('button')).toBeNull()
  details.focus(); expect(document.activeElement).toBe(details)
  await act(() => details.click())
  expect(exerciseDetailSheet).toHaveBeenCalledOnce()
  const routine = details.closest('.item').querySelector('.btn')
  await act(() => routine.click())
  expect(addToRoutineSheet).toHaveBeenCalledWith(exerciseDetailSheet.mock.calls[0][0])
  expect(exerciseDetailSheet).toHaveBeenCalledOnce()
})
