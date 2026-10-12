// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import RoutineExchange from './RoutineExchange.jsx'
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
it('shows preview and requires conflicts to be explicitly chosen before one persisted update', async () => {
  render(); await upload(); expect(host.textContent).toContain('Review import'); expect(button('Confirm import').disabled).toBe(true)
  const conflict = [...host.querySelectorAll('select')].find(el => el.querySelector('option[value="replace"]')); change(conflict, 'replace')
  expect(button('Confirm import').disabled).toBe(true)
  act(() => host.querySelector('input[aria-label="I confirm replacing the selected existing data"]').click())
  expect(button('Confirm import').disabled).toBe(false); await act(async () => button('Confirm import').click())
  expect(mock.update).toHaveBeenCalledTimes(1); expect(mock.S.routines).toHaveLength(1); expect(close).toHaveBeenCalledTimes(1)
})
it('previews every prescribed series including warmups, ranges, units and rest before saving', async () => {
  mock.S.routines[0].ex[0] = { id: CATALOGUE[0].id, sets: 2, warmupSets: 1, reps: 10, repsMin: 8, repRange: true, weight: 12.5, targetRirMin: 1, targetRirMax: 2, restSec: 90 }
  mock.read.mockResolvedValue({ data: createRoutineExchange(mock.S), errors: [] })
  render(); await upload()
  expect(host.querySelectorAll('.routine-exchange-series tbody tr')).toHaveLength(3)
  expect(host.textContent).toContain('8–10 reps')
  expect(host.textContent).toContain('12.5 kg')
  expect(host.textContent).toContain('RIR 1–2')
  expect(host.textContent).toContain('90 s')
  expect(mock.update).not.toHaveBeenCalled()
})
it('previews and imports source prescription rules without overwriting destination defaults', async () => {
  const source = structuredClone(mock.S)
  source.routines[0].id = 'incoming'; source.routines[0].name = 'Incoming routine'; source.routineOrder = ['incoming']
  source.routines[0].ex[0] = { id: CATALOGUE[0].id, sets: 2, reps: 8, weight: 20, setScheme: 'topback', topSets: 1, backoffSets: 1, autoBackoffReps: true }
  source.backoffRepsMode = 'increased'; source.restSec = 30
  mock.S.backoffRepsMode = 'same'; mock.S.restSec = 120
  mock.read.mockResolvedValue({ data: createRoutineExchange(source), errors: [] })
  render(); await upload()
  const backoff = () => [...host.querySelectorAll('.routine-exchange-series tbody tr')].find(row => row.textContent.includes('Back-off'))
  expect(backoff().textContent).toContain('10 reps')
  expect(backoff().textContent).toContain('30 s')
  expect(host.textContent).not.toContain('Apply imported default rest, effort and Back-off preferences')
  await act(async () => button('Confirm import').click())
  expect(mock.S.backoffRepsMode).toBe('same')
  expect(mock.S.restSec).toBe(120)
  expect(mock.S.routines.find(r => r.id === 'incoming').ex[0]).toMatchObject({ backoffRepsMode: 'increased', backoffRepsOverride: true, restSec: 30 })
  expect(mock.update).toHaveBeenCalledTimes(1)
})
it('resets schedule decisions for a new file and when canceling', async () => {
  render(); await upload()
  const options = () => [...host.querySelectorAll('.routine-exchange-preview label input[type="checkbox"]')]
  act(() => { options().forEach(option => option.click()) })
  await upload()
  expect(options().every(input => !input.checked)).toBe(true)
  act(() => { options()[0].click(); button('Cancel import').click() })
  await upload()
  expect(options().every(input => !input.checked)).toBe(true)
  expect(mock.update).not.toHaveBeenCalled()
})
it('requires an explicit source unit for old plans that omitted it', async () => {
  mock.S.routines = []; mock.S.routineOrder = []
  mock.read.mockResolvedValue({ data: { framegym_plan: 1, routines: [{ id: 'old', name: 'Old plan', ex: [{ id: CATALOGUE[0].id, sets: 2, reps: 8, weight: 20 }] }], week: {} }, errors: [] })
  render(); await upload()
  expect(button('Confirm import').disabled).toBe(true)
  const unit = host.querySelector('select[aria-label="Source weight unit of the legacy file"]')
  expect(unit).not.toBeNull(); change(unit, 'lb')
  const conversion = [...host.querySelectorAll('select')].find(el => el.querySelector('option[value="convert"]'))
  expect(conversion).toBeDefined(); change(conversion, 'convert')
  const adaptations = host.querySelector('input[aria-label="I accept these adaptations for this import"]')
  if (adaptations) act(() => adaptations.click())
  expect(button('Confirm import').disabled).toBe(false); await act(async () => button('Confirm import').click())
  expect(mock.S.routines[0].ex[0].weight).toBeCloseTo(20 / 2.2046226218)
  expect(mock.update).toHaveBeenCalledTimes(1)
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

it('keeps a failed primary save reviewable with no profile change and retries the complete draft once', async () => {
  const source = structuredClone(mock.S); source.routines[0].id = 'new'; source.routines[0].name = 'New'; source.routines[0].ex[0].reps = 12; source.routineOrder = ['new']
  mock.read.mockResolvedValue({ data: createRoutineExchange(source), errors: [] })
  const before = structuredClone(mock.S)
  mock.update.mockImplementationOnce(() => { throw new Error('QuotaExceededError') })
  render(); await upload(); await act(async () => button('Confirm import').click())
  expect(mock.S).toEqual(before); expect(close).not.toHaveBeenCalled()
  expect(host.querySelector('[role="alert"] p').textContent).toContain('storage quota')
  expect(host.querySelector('.routine-exchange-diagnostics').open).toBe(false)
  expect(host.querySelector('.routine-exchange-diagnostics').textContent).toContain('QuotaExceededError')
  await act(async () => button('Retry import').click())
  expect(mock.S.routines).toHaveLength(2); expect(mock.update).toHaveBeenCalledTimes(2); expect(close).toHaveBeenCalledOnce()
})

it('keeps an intermediate persistence failure atomic and retries once without importing a second copy', async () => {
  const source = structuredClone(mock.S); source.routines[0].id = 'new'; source.routines[0].name = 'New'; source.routines[0].ex[0].reps = 12; source.routineOrder = ['new']
  mock.read.mockResolvedValue({ data: createRoutineExchange(source), errors: [] })
  const before = structuredClone(mock.S), cause = new DOMException('The quota has been exceeded.', 'QuotaExceededError')
  const failure = new Error('Could not persist resources', { cause }); failure.diagnostics = { stage: 'resources-write', backend: 'IndexedDB', database: 'tgym-profile', store: 'resources', key: 'media:anonymous', attemptedBytes: 5000, previousBytes: 1000 }
  mock.update.mockImplementationOnce(async fn => { const draft = structuredClone(mock.S); fn(draft); await Promise.resolve(); throw failure })
  render(); await upload(); await act(async () => button('Confirm import').click())
  expect(mock.S).toEqual(before); expect(mock.update).toHaveBeenCalledOnce(); expect(close).not.toHaveBeenCalled()
  expect(host.querySelector('[role="alert"] p').textContent).toContain('storage quota')
  const details = host.querySelector('.routine-exchange-diagnostics').textContent
  expect(details).toContain('resources-write'); expect(details).toContain('tgym-profile'); expect(details).toContain('media:anonymous'); expect(details).toContain('QuotaExceededError')
  expect(JSON.parse(host.querySelector('.routine-exchange-diagnostics pre').textContent).failures[1].stack).toBe(cause.stack || '')
  expect(button('Cancel import').disabled).toBe(false)
  await act(async () => button('Retry import').click())
  expect(mock.S.routines).toHaveLength(2); expect(mock.update).toHaveBeenCalledTimes(2); expect(close).toHaveBeenCalledOnce()
})

it('requires acknowledgement of file-level legacy resource warnings and cancellation leaves the profile unchanged', async () => {
  mock.read.mockResolvedValue({ data: createRoutineExchange(mock.S), errors: [], warnings: [{ sheet: 'Catálogo', row: 2, field: 'definition', message: 'Legacy media cannot be recovered; export the original file again.' }] })
  const before = structuredClone(mock.S)
  render(); await upload(); expect(host.textContent).toContain('Legacy media cannot be recovered')
  const conflict = [...host.querySelectorAll('select')].find(el => el.querySelector('option[value="copy"]')); change(conflict, 'copy')
  expect(button('Confirm import').disabled).toBe(true)
  act(() => host.querySelector('input[aria-label="I accept these adaptations for this import"]').click())
  expect(button('Confirm import').disabled).toBe(false)
  act(() => button('Cancel import').click())
  expect(mock.S).toEqual(before); expect(mock.update).not.toHaveBeenCalled()
})

it('ignores a late file read after cancelling it and permits the next file to recover', async () => {
  let finish; mock.read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  render(); const input = host.querySelector('input[type="file"]'); Object.defineProperty(input, 'files', { configurable: true, value: [new File(['fixture'], 'late.json')] })
  let pending; act(() => { input.dispatchEvent(new Event('change', { bubbles: true })); pending = true })
  expect(pending).toBe(true); act(() => button('Cancel').click())
  await act(async () => finish({ data: createRoutineExchange(mock.S), errors: [] }))
  expect(host.textContent).not.toContain('Review import'); expect(mock.update).not.toHaveBeenCalled()
  await upload(); expect(host.textContent).toContain('Review import')
})

it('previews Rest-pause activation repetitions and the total Working target', async () => {
  mock.S.routines[0].ex[0] = { id: CATALOGUE[0].id, sets: 3, reps: 8, weight: 30, intensifier: { type: 'restpause', totalReps: 15, restSec: 15 } }
  mock.read.mockResolvedValue({ data: createRoutineExchange(mock.S), errors: [] })
  await render(); await upload()
  const rows = [...host.querySelectorAll('.routine-exchange-series tbody tr')]
  expect(rows).toHaveLength(2)
  expect(rows[0].textContent).toContain('Warm-up'); expect(rows[0].textContent).toContain('8 reps · 30 kg')
  expect(rows[1].textContent).toContain('15 reps · 30 kg')
  expect(rows[0].textContent).not.toContain('Automatic warm-up')
})

it('blocks double confirmation and cancellation until the persisted transaction finishes', async () => {
  const source = structuredClone(mock.S); source.routines[0].id = 'incoming'; source.routines[0].name = 'Incoming'; source.routineOrder = ['incoming']; source.routines[0].ex[0].reps = 12
  mock.read.mockResolvedValue({ data: createRoutineExchange(source), errors: [] })
  let finish
  mock.update.mockImplementationOnce(fn => {
    const draft = structuredClone(mock.S); fn(draft)
    return new Promise(resolve => { finish = () => { mock.S = draft; resolve() } })
  })
  const before = structuredClone(mock.S)
  render(); await upload()
  act(() => { button('Confirm import').click(); button('Confirm import').click() })
  expect(mock.update).toHaveBeenCalledOnce(); expect(mock.S).toEqual(before); expect(close).not.toHaveBeenCalled()
  expect(host.querySelector('[role="status"]').textContent).toBe('Saving import…')
  expect(button('Cancel')).toBeUndefined(); expect(button('Cancel import').disabled).toBe(true); expect(button('Done').disabled).toBe(true)
  await act(async () => finish())
  expect(mock.S.routines).toHaveLength(2); expect(close).toHaveBeenCalledOnce()
  expect(mock.update.mock.calls[0].slice(1)).toEqual([true, false])
})

it('retains unit, schedule and adaptation choices on failure, and cancellation preserves the complete prior profile', async () => {
  Object.assign(mock.S, { workouts: [{ id: 'history', routineId: 'r', entries: [] }], active: { id: 'active', routineId: 'r', entries: [] }, theme: 'light', unit: 'lb', customEx: [{ id: 'local', n: 'Local', custom: true }], week: { 1: ['r'] }, dayPlan: { '2026-10-11': ['r'] } })
  const source = structuredClone(mock.S); source.unit = 'kg'; source.routines[0].id = 'incoming'; source.routines[0].name = 'Incoming'; source.routineOrder = ['incoming']; source.routines[0].ex[0].reps = 12; source.deload = { on: true, startDate: '2026-10-01', every: 4, deloadWeeks: 1 }; source.week = { 2: ['incoming'] }; source.dayPlan = {}
  mock.read.mockResolvedValue({ data: createRoutineExchange(source), errors: [] })
  mock.update.mockImplementationOnce(fn => { const draft = structuredClone(mock.S); fn(draft); throw new DOMException('The quota has been exceeded.', 'QuotaExceededError') })
  const before = structuredClone(mock.S)
  render(); await upload()
  const unit = host.querySelector('select[aria-label="Conflict: kg → lb"]'); change(unit, 'convert')
  const schedule = [...host.querySelectorAll('label')].find(label => label.textContent === 'Apply imported schedule (preserves other routines)').querySelector('input')
  act(() => { schedule.click(); host.querySelector('input[aria-label="I accept these adaptations for this import"]').click() })
  await act(async () => button('Confirm import').click())
  expect(mock.S).toEqual(before); expect(unit.value).toBe('convert'); expect(schedule.checked).toBe(true)
  expect(host.querySelector('input[aria-label="I accept these adaptations for this import"]').checked).toBe(true)
  act(() => button('Cancel import').click())
  expect(mock.S).toEqual(before); expect(host.textContent).not.toContain('Review import'); expect(host.querySelector('[role="alert"]')).toBeNull(); expect(close).not.toHaveBeenCalled()
})

it.each(['quota', 'permission', 'validation', 'read'])('keeps %s file errors distinct and technical details collapsed', async kind => {
  const failures = { quota: new DOMException('The quota has been exceeded.', 'QuotaExceededError'), permission: new DOMException('Access denied', 'NotAllowedError'), validation: new SyntaxError('Unexpected token'), read: new Error('File access failed') }
  mock.read.mockRejectedValue(failures[kind])
  render(); await upload()
  const text = host.querySelector('[role="alert"] p').textContent
  const expected = { quota: 'storage quota', permission: 'did not permit', validation: 'format validation', read: 'could not read' }
  expect(text).toContain(expected[kind]); expect(text).not.toContain(failures[kind].message)
  expect(host.querySelector('.routine-exchange-diagnostics').open).toBe(false); expect(mock.update).not.toHaveBeenCalled()
})

it('shows the declared file unit without a false kg fallback when both profiles use lb', async () => {
  mock.S.unit = 'lb'; const source = structuredClone(mock.S); source.routines[0].id = 'lb-source'; source.routines[0].name = 'LB source'; source.routineOrder = ['lb-source']; source.routines[0].ex[0].reps = 12
  mock.read.mockResolvedValue({ data: createRoutineExchange(source), errors: [] })
  render(); await upload()
  expect(host.textContent).toContain('File unit: lb · This device: lb'); expect(host.textContent).not.toContain('kg → lb')
  expect(host.querySelector('select[aria-label^="Conflict:"]')).toBeNull()
  await act(async () => button('Confirm import').click())
  expect(mock.S.routines.find(r => r.id === 'lb-source').ex[0].weight).toBe(10)
})

it('localizes Spanish adaptation and quota recovery messages without changing prescription meaning', async () => {
  mock.es = true
  const source = structuredClone(mock.S); source.routines[0].id = 'incoming'; source.routines[0].name = 'Incoming'; source.routineOrder = ['incoming']; source.routines[0].ex[0].reps = 12; source.effort = 'rpe'; source.deload = { on: true, startDate: '2026-10-01', every: 4, deloadWeeks: 1 }
  mock.read.mockResolvedValue({ data: createRoutineExchange(source), errors: [] }); mock.update.mockImplementationOnce(() => { throw new DOMException('The quota has been exceeded.', 'QuotaExceededError') })
  render(); await upload()
  expect(host.textContent).toContain('El deload está activado en el origen o en este dispositivo.')
  expect(host.textContent).toContain('La escala de esfuerzo difiere (RPE → Ninguno).')
  expect(host.textContent).not.toContain('Deload is enabled'); expect(host.textContent).not.toContain('Destination preferences remain unchanged')
  act(() => host.querySelector('input[aria-label="Acepto estas adaptaciones para esta importación"]').click())
  await act(async () => button('Confirmar importación').click())
  expect(host.querySelector('[role="alert"] p').textContent).toContain('se superó la cuota de almacenamiento de TGym')
  expect(button('Reintentar importación')).toBeDefined(); expect(button('Cancelar importación')).toBeDefined()
  expect(host.querySelector('.routine-exchange-diagnostics summary').textContent).toBe('Detalles técnicos')
  expect(mock.S.effort).toBeUndefined(); expect(mock.S.deload).toBeUndefined()
})
