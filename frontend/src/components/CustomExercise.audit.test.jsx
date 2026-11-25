// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { customExSheet, deleteCustomEx } from '../sheets.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { EXIDX, registerCustom } from '../lib/exercises.js'
import { createBackup, readBackup } from '../lib/backup.js'
import { setLang } from '../lib/i18n.js'

let root, host
const state = () => useStore.getState().S
const button = text => [...host.querySelectorAll('button')].find(b => b.textContent === text)
const click = text => act(() => button(text).click())
function Sheets() { return useUI(s => s.sheets).map(s => <div key={s.id}>{s.render(() => useUI.getState().closeSheet(s.id))}</div>) }
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  await setLang('en'); localStorage.clear()
  useStore.setState({ S: structuredClone(DEF), user: null })
  useUI.setState({ sheets: [], timer: null, work: null, toastMsg: '' })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  act(() => root.render(<Sheets />))
})
afterEach(() => { act(() => root.unmount()); host.remove(); registerCustom([]) })

it('requires a custom name and body part, cancels without writes, and persists a new stable exercise ID', () => {
  act(() => customExSheet())
  click('Create exercise'); expect(state().customEx).toEqual([]); expect(useUI.getState().toastMsg).toBe('Give it a name')
  act(() => {
    const field = host.querySelector('input[aria-label="Exercise name"]')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, 'QA unique exercise')
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
  click('Create exercise'); expect(state().customEx).toEqual([]); expect(useUI.getState().toastMsg).toBe('Pick a body part')
  act(() => useUI.getState().closeAll()); expect(state().customEx).toEqual([])
  act(() => customExSheet(null, null, 'QA unique exercise'))
  click('chest'); click('Create exercise')
  const saved = JSON.parse(localStorage.getItem('gym_state_v1'))
  expect(saved.customEx).toHaveLength(1)
  expect(saved.customEx[0]).toMatchObject({ n: 'QA unique exercise', bp: 'chest', custom: true })
  expect(EXIDX[saved.customEx[0].id].n).toBe('QA unique exercise')
  expect(readBackup(createBackup(saved)).customEx[0].id).toBe(saved.customEx[0].id)
})

it('blocks active custom deletion, respects cancellation, then retains historical sets and cleans only its prescriptions', () => {
  const ex = { id: 'qa-custom-delete', n: 'QA custom history', bp: 'chest', tg: 'pectorals', eq: 'custom', custom: true }
  const sets = [{ done: true, w: 42.5, r: 8, rir: 2, drops: [{ w: 30, r: 6 }] }]
  act(() => useStore.getState().update(s => {
    s.customEx = [ex]; s.exerciseAliases = { [ex.id]: 'Alias' }; s.exWeights = { [ex.id]: 42.5 }
    s.routines = [{ id: 'r', name: 'R', ex: [{ id: ex.id, sg: 'pair' }, { id: '0025', sg: 'pair', reps: 8 }] }]
    s.workouts = [{ id: 'history', d: '2026-10-18', entries: [{ id: ex.id, sets }] }]
    s.active = { id: 'active', start: Date.now(), entries: [{ id: ex.id, sets: [] }] }
  }))
  act(() => deleteCustomEx(ex)); expect(useUI.getState().sheets).toEqual([]); expect(state().customEx).toHaveLength(1)
  act(() => useStore.getState().update(s => { s.active = null }))
  act(() => deleteCustomEx(ex)); click('Cancel'); expect(state().customEx).toHaveLength(1)
  act(() => deleteCustomEx(ex)); click('Delete')
  const saved = JSON.parse(localStorage.getItem('gym_state_v1'))
  expect(saved.customEx).toEqual([]); expect(saved.workouts[0].entries[0].sets).toEqual(sets)
  expect(saved.workouts[0].entries[0]).toMatchObject({ id: ex.id, n: ex.n })
  expect(saved.workouts[0].entries[0].muscleSnapshot).toBeTruthy()
  expect(saved.routines[0].ex).toEqual([{ id: '0025', reps: 8 }])
  expect(saved.exerciseAliases[ex.id]).toBeUndefined(); expect(saved.exWeights[ex.id]).toBeUndefined()
  expect(readBackup(createBackup(saved)).workouts[0].entries[0].sets).toEqual(sets)
})
