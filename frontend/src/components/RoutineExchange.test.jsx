// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import RoutineExchange from './RoutineExchange.jsx'
import { CATALOGUE } from '../lib/exercises.js'
import { createRoutineExchange } from '../lib/routine-exchange.js'
const mock = vi.hoisted(() => ({ S: null, update: vi.fn(), build: vi.fn(), read: vi.fn(), save: vi.fn() }))
vi.mock('../store/useStore.js', () => ({ useStore: selector => selector({ S: mock.S, update: mock.update }) }))
vi.mock('../lib/i18n.js', () => ({ t: (key, ...args) => args.reduce((s, value, i) => s.replaceAll(`{${i}}`, value), key) }))
vi.mock('../lib/routine-exchange.js', async original => ({ ...await original(), buildRoutineExchangeFile: (...args) => mock.build(...args), readRoutineExchangeFile: (...args) => mock.read(...args) }))
vi.mock('../lib/report-file.js', () => ({ saveReportFile: (...args) => mock.save(...args) }))
let host, root, close
const button = text => [...host.querySelectorAll('button')].find(el => el.textContent === text)
const render = () => act(() => root.render(<RoutineExchange close={close}/>))
const change = (element, value) => act(() => { element.value = value; element.dispatchEvent(new Event('change', { bubbles: true })) })
async function upload() { const input = host.querySelector('input[type="file"]'); Object.defineProperty(input, 'files', { configurable: true, value: [new File(['fixture'], 'plan.json')] }); await act(async () => input.dispatchEvent(new Event('change', { bubbles: true }))) }
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  mock.S = { unit: 'kg', routines: [{ id: 'r', name: 'Routine one', ex: [{ id: CATALOGUE[0].id, sets: 2, reps: 8, weight: 10 }] }], routineOrder: ['r'], customEx: [], week: {}, dayPlan: {} }
  mock.update.mockReset().mockImplementation(fn => { const draft = structuredClone(mock.S); fn(draft); mock.S = draft })
  mock.build.mockReset().mockResolvedValue({ name: 'TGym-routines.json', blob: new Blob(['fixture']) })
  mock.read.mockReset().mockResolvedValue({ data: createRoutineExchange(mock.S), errors: [] }); mock.save.mockReset().mockResolvedValue(undefined)
  host = document.createElement('div'); document.body.append(host); root = createRoot(host); close = vi.fn()
})
afterEach(() => { act(() => root.unmount()); host.remove() })
it('confirms selected routines and format before explicit download, including retry', async () => {
  render(); change(host.querySelector('select'), 'xlsx'); await act(async () => button('Prepare export').click())
  expect(mock.build).toHaveBeenCalledWith(mock.S, ['r'], 'xlsx', expect.objectContaining({ template: false }))
  expect(mock.save).not.toHaveBeenCalled(); expect(host.textContent).toContain('TGym-routines.json')
  mock.save.mockRejectedValueOnce(new Error('disk')); await act(async () => button('Download').click())
  expect(host.querySelector('[role="alert"]').textContent).toContain('Download again'); await act(async () => button('Download').click()); expect(mock.save).toHaveBeenCalledTimes(2)
})
it('cancels preparation and ignores late results and repeated presses', async () => {
  let resolve; mock.build.mockImplementation(() => new Promise(r => { resolve = r })); render()
  act(() => { button('Prepare export').click(); button('Prepare export').click() }); expect(mock.build).toHaveBeenCalledTimes(1)
  act(() => button('Cancel').click()); await act(async () => resolve({ name: 'late.json', blob: new Blob(['late']) }))
  expect(host.textContent).not.toContain('late.json'); expect(mock.save).not.toHaveBeenCalled()
})
it('shows preview and requires conflicts to be explicitly chosen before one persisted update', async () => {
  render(); await upload(); expect(host.textContent).toContain('Review import'); expect(button('Confirm import').disabled).toBe(true)
  const conflict = [...host.querySelectorAll('select')].find(el => el.querySelector('option[value="replace"]')); change(conflict, 'replace')
  expect(button('Confirm import').disabled).toBe(false); act(() => button('Confirm import').click())
  expect(mock.update).toHaveBeenCalledTimes(1); expect(mock.S.routines).toHaveLength(1); expect(close).toHaveBeenCalledTimes(1)
})
it('blocks all writes when any concrete sheet/row/field error exists', async () => {
  mock.read.mockResolvedValue({ data: createRoutineExchange(mock.S), errors: [{ sheet: 'Series', row: 8, field: 'Peso', message: 'Expected number' }] })
  render(); await upload(); expect(host.querySelector('[role="alert"]').textContent).toContain('Series #8 · Peso: Expected number')
  expect(button('Confirm import').disabled).toBe(true); expect(mock.update).not.toHaveBeenCalled()
})
it('keeps malformed JSON preview recoverable without rendering invalid collections', async () => {
  mock.read.mockResolvedValue({ data: { tgym_routine_exchange: 1, unit: 'kg', routines: 'wrong', catalog: null }, errors: [] })
  render(); await upload(); expect(host.querySelector('[role="alert"]').textContent).toContain('Include between 1 and 500 routines'); expect(button('Confirm import').disabled).toBe(true); expect(mock.update).not.toHaveBeenCalled()
})
it('asks for unknown exercise mapping and keeps import blocked until the mapping and conflicts are resolved', async () => {
  const data = createRoutineExchange(mock.S); data.routines[0].ex[0].id = 'unknown'; data.catalog.push({ id: 'unknown', n: 'Unknown choice' }); mock.read.mockResolvedValue({ data, errors: [] })
  render(); await upload(); expect(host.textContent).toContain('Map unknown exercise: Unknown choice'); expect(button('Confirm import').disabled).toBe(true)
  const mapping = [...host.querySelectorAll('select')].find(el => el.querySelector(`option[value="${CATALOGUE[0].id}"]`)); change(mapping, CATALOGUE[0].id)
  const conflict = [...host.querySelectorAll('select')].find(el => el.querySelector('option[value="copy"]')); change(conflict, 'copy')
  expect(button('Confirm import').disabled).toBe(false)
})
