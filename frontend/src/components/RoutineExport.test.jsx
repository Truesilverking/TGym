// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import RoutineExchange from './RoutineExport.jsx'
import { CATALOGUE } from '../lib/exercises.js'
import { createRoutineExchange } from '../lib/routine-exchange.js'
const mock = vi.hoisted(() => ({ S: null, update: vi.fn(), build: vi.fn(), read: vi.fn(), save: vi.fn(), es: false }))
vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector({ S: mock.S, updateAtomic: mock.update })
  return { useStore }
})
vi.mock('../lib/i18n.js', async () => {
  const { default: es } = await import('../locales/es.js')
  return { t: (key, ...args) => args.reduce((s, value, i) => s.replaceAll(`{${i}}`, value), mock.es ? es[key] || key : key) }
})
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
  mock.es = false
  host = document.createElement('div'); document.body.append(host); root = createRoot(host); close = vi.fn()
})
afterEach(() => { act(() => root.unmount()); host.remove() })
it.each(['json', 'xlsx', 'pdf'])('prepares %s before direct download and retains the same file for retry', async format => {
  const file = { name: `TGym-routines.${format}`, blob: new Blob(['fixture']) }
  mock.build.mockResolvedValue(file)
  render(); change(host.querySelector('select'), format); await act(async () => button('Prepare export').click())
  expect(mock.build).toHaveBeenCalledWith(mock.S, ['r'], format, expect.objectContaining({ template: false }))
  expect(mock.save).not.toHaveBeenCalled(); expect(host.textContent).toContain(file.name)
  mock.save.mockRejectedValueOnce(new Error('disk')); await act(async () => button('Download').click())
  expect(host.querySelector('[role="alert"]').textContent).toContain('Download again'); expect(host.textContent).toContain(file.name)
  await act(async () => button('Download').click())
  expect(mock.save.mock.calls).toEqual([[file], [file]])
  expect(host.querySelector('[role="alert"]')).toBeNull(); expect(mock.build).toHaveBeenCalledTimes(1)
})
it('cancels preparation and ignores late results and repeated presses', async () => {
  let resolve; mock.build.mockImplementation(() => new Promise(r => { resolve = r })); render()
  act(() => { button('Prepare export').click(); button('Prepare export').click() }); expect(mock.build).toHaveBeenCalledTimes(1)
  act(() => button('Cancel').click()); await act(async () => resolve({ name: 'late.json', blob: new Blob(['late']) }))
  expect(host.textContent).not.toContain('late.json'); expect(mock.save).not.toHaveBeenCalled()
})
it('keeps actionable export errors visible and allows a different format to recover', async () => {
  mock.build.mockRejectedValueOnce(new Error('Rutinas, row 2, Notas exceeds 32767 characters; export JSON'))
  render(); await act(async () => button('Prepare export').click())
  expect(host.querySelector('[role="alert"]').textContent).toContain('32767 characters; export JSON')
  await act(async () => button('Prepare export').click())
  expect(host.querySelector('[role="alert"]')).toBeNull(); expect(host.textContent).toContain('TGym-routines.json')
})
