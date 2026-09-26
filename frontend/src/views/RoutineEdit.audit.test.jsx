// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import RoutineEdit from './RoutineEdit.jsx'
import { useStore, DEF } from '../store/useStore.js'
import { setLang } from '../lib/i18n.js'
import { exConfigSheet } from '../sheets.jsx'

vi.mock('../sheets.jsx', async original => ({ ...await original(), exConfigSheet: vi.fn() }))
let host, root
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  await setLang('en'); localStorage.clear(); vi.clearAllMocks()
  useStore.setState({ S: { ...structuredClone(DEF), routines: [{ id: 'r', name: 'Upper', ex: [{ id: '0025', sets: 3, reps: 10 }, { id: '0001', sets: 2, reps: 8 }] }] }, user: null })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(() => root.unmount()); host.remove() })
it('offers separate accessible edit/reorder actions and persists the new exercise order', async () => {
  await act(() => root.render(<MemoryRouter initialEntries={['/plan/r/r']}><Routes><Route path="/plan/r/:id" element={<RoutineEdit />} /></Routes></MemoryRouter>))
  expect(host.querySelector('input[aria-label="Routine"]').value).toBe('Upper')
  expect(host.querySelector('button[aria-label="Move up"]').disabled).toBe(true)
  await act(() => host.querySelector('button.routine-exercise-open').click())
  expect(exConfigSheet).toHaveBeenCalledOnce()
  await act(() => host.querySelector('button[aria-label="Move down"]').click())
  expect(exConfigSheet).toHaveBeenCalledOnce()
  const saved = JSON.parse(localStorage.getItem('gym_state_v1'))
  expect(saved.routines[0].ex.map(e => e.id)).toEqual(['0001','0025'])
  expect(saved.routines[0].ex.map(e => e.reps)).toEqual([8,10])
})
