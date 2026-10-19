// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import RoutineExchange from './RoutineImport.jsx'
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
const button = text => {
  if (text === 'Confirm import' || text === 'Confirmar importaci?n') return host.querySelector('.routine-import-footer .primary')
  if (text === 'Cancel') text = 'Cancel import'
  return [...host.querySelectorAll('button')].find(el => el.textContent === text)
}
async function saveAndSettle(control) {
  await act(() => control.click())
  await vi.waitFor(async () => {
    await act(async () => {})
    expect(host.querySelector('[data-step=saving]')).toBeNull()
  })
}
async function confirm() {
  if (host.querySelector('[data-step=review]')) await act(() => host.querySelector('.routine-import-footer .primary').click())
  await saveAndSettle(host.querySelector('.routine-import-footer .primary'))
  if (host.querySelector('[data-step=success]')) await act(() => button(mock.es ? 'Ver rutinas' : 'View routines').click())
}
const render = () => act(() => root.render(<RoutineExchange close={close}/>))
const change = (element, value) => act(() => { element.value = value; element.dispatchEvent(new Event('change', { bubbles: true })) })
async function upload() { const input = host.querySelector('input[type="file"]'); Object.defineProperty(input, 'files', { configurable: true, value: [new File(['fixture'], 'plan.json')] }); await act(async () => input.dispatchEvent(new Event('change', { bubbles: true }))) }
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.stubGlobal('requestAnimationFrame', callback => setTimeout(() => callback(0), 0))
  mock.S = { unit: 'kg', routines: [{ id: 'r', name: 'Routine one', ex: [{ id: CATALOGUE[0].id, sets: 2, reps: 8, weight: 10 }] }], routineOrder: ['r'], customEx: [], week: {}, dayPlan: {} }
  mock.update.mockReset().mockImplementation(fn => { const draft = structuredClone(mock.S); fn(draft); mock.S = draft })
  mock.build.mockReset().mockResolvedValue({ name: 'TGym-routines.json', blob: new Blob(['fixture']) })
  mock.read.mockReset().mockResolvedValue({ data: createRoutineExchange(mock.S), errors: [] }); mock.save.mockReset().mockResolvedValue(undefined)
  mock.es = false
  host = document.createElement('div'); document.body.append(host); root = createRoot(host); close = vi.fn()
})
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals() })
it('shows preview and requires conflicts to be explicitly chosen before one persisted update', async () => {
  render(); act(() => root.unmount()); root = createRoot(host); render(); await upload(); expect(host.textContent).toContain('Review routines'); expect(button('Confirm import').disabled).toBe(true)
  const conflict = [...host.querySelectorAll('select')].find(el => el.querySelector('option[value="replace"]')); change(conflict, 'replace')
  expect(button('Confirm import').disabled).toBe(true)
  act(() => host.querySelector('input[aria-label="I confirm replacing the selected existing data"]').click())
  expect(button('Confirm import').disabled).toBe(false); await confirm()
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
  await confirm()
  expect(mock.S.backoffRepsMode).toBe('same')
  expect(mock.S.restSec).toBe(120)
  expect(mock.S.routines.find(r => r.id === 'incoming').ex[0]).toMatchObject({ backoffRepsMode: 'increased', backoffRepsOverride: true, restSec: 30 })
  expect(mock.update).toHaveBeenCalledTimes(1)
})
it('resets schedule decisions for a new file and when canceling', async () => {
  const source = structuredClone(mock.S); source.routines[0].id = 'incoming'; source.routines[0].name = 'Incoming'; source.routines[0].ex[0].reps = 12; source.routineOrder = ['incoming']; source.week = { 1: ['incoming'] }
  mock.read.mockResolvedValue({ data: createRoutineExchange(source), errors: [] })
  render(); await upload()
  const options = () => [...host.querySelectorAll('.routine-import-decision label input[type="checkbox"]')]
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
  const conversion = host.querySelector('input[aria-label^="Convert weights to"]')
  expect(conversion).toBeDefined(); expect(conversion.checked).toBe(true)
  const adaptations = host.querySelector('input[aria-label="I accept these adaptations for this import"]')
  if (adaptations) act(() => adaptations.click())
  expect(button('Confirm import').disabled).toBe(false); await confirm()
  expect(mock.S.routines[0].ex[0].weight).toBeCloseTo(20 / 2.2046226218)
  expect(mock.update).toHaveBeenCalledTimes(1)
})
it('blocks all writes when any concrete sheet/row/field error exists', async () => {
  mock.read.mockResolvedValue({ data: createRoutineExchange(mock.S), errors: [{ sheet: 'Series', row: 8, field: 'Peso', message: 'Expected number' }] })
  render(); await upload(); expect(host.querySelector('[role="alert"]').textContent).toContain('Expected number')
  expect(button('Confirm import').disabled).toBe(true); expect(mock.update).not.toHaveBeenCalled()
})
it('keeps malformed JSON preview recoverable without rendering invalid collections', async () => {
  mock.read.mockResolvedValue({ data: { tgym_routine_exchange: 1, unit: 'kg', routines: 'wrong', catalog: null }, errors: [] })
  render(); await upload(); expect(host.querySelector('[role="alert"]').textContent).toContain('Include between 1 and 500 routines'); expect(button('Confirm import').disabled).toBe(true); expect(mock.update).not.toHaveBeenCalled()
})
it('asks for unknown exercise mapping and keeps import blocked until the mapping and conflicts are resolved', async () => {
  const data = createRoutineExchange(mock.S); data.routines[0].ex[0].id = 'unknown'; data.catalog.push({ id: 'unknown', n: 'Unknown choice' }); mock.read.mockResolvedValue({ data, errors: [] })
  render(); await upload(); expect(host.textContent).not.toContain('Map unknown exercise: Unknown choice'); expect(button('Confirm import').disabled).toBe(true)
  const initialConflict = [...host.querySelectorAll('select')].find(el => el.querySelector('option[value="copy"]')); change(initialConflict, 'copy')
  expect(host.textContent).toContain('Map unknown exercise: Unknown choice')
  const mapping = [...host.querySelectorAll('select')].find(el => el.querySelector(`option[value="${CATALOGUE[0].id}"]`)); change(mapping, CATALOGUE[0].id)
  const conflict = [...host.querySelectorAll('select')].find(el => el.querySelector('option[value="copy"]')); change(conflict, 'copy')
  expect(button('Confirm import').disabled).toBe(false)
})

it('keeps a failed primary save reviewable with no profile change and retries the complete draft once', async () => {
  const source = structuredClone(mock.S); source.routines[0].id = 'new'; source.routines[0].name = 'New'; source.routines[0].ex[0].reps = 12; source.routineOrder = ['new']
  mock.read.mockResolvedValue({ data: createRoutineExchange(source), errors: [] })
  const before = structuredClone(mock.S)
  mock.update.mockImplementationOnce(() => { throw new Error('QuotaExceededError') })
  render(); await upload(); await confirm()
  expect(mock.S).toEqual(before); expect(close).not.toHaveBeenCalled()
  expect(host.querySelector('[role="alert"] p').textContent).toContain('storage quota')
  expect(host.querySelector('.routine-exchange-diagnostics').open).toBe(false)
  expect(host.querySelector('[role="alert"]').compareDocumentPosition(host.querySelector('.routine-import-summary')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(host.querySelector('.routine-exchange-diagnostics').textContent).toContain('QuotaExceededError')
  await saveAndSettle(button('Retry import'))
  if (host.querySelector('[data-step=success]')) act(() => button('View routines').click())
  expect(mock.S.routines).toHaveLength(2); expect(mock.update).toHaveBeenCalledTimes(2); expect(close).toHaveBeenCalledOnce()
})

it('keeps an intermediate persistence failure atomic and retries once without importing a second copy', async () => {
  const source = structuredClone(mock.S); source.routines[0].id = 'new'; source.routines[0].name = 'New'; source.routines[0].ex[0].reps = 12; source.routineOrder = ['new']
  mock.read.mockResolvedValue({ data: createRoutineExchange(source), errors: [] })
  const before = structuredClone(mock.S), cause = new DOMException('The quota has been exceeded.', 'QuotaExceededError')
  const failure = new Error('Could not persist resources', { cause }); failure.diagnostics = { stage: 'resources-write', backend: 'IndexedDB', database: 'tgym-profile', store: 'resources', key: 'media:anonymous', attemptedBytes: 5000, previousBytes: 1000 }
  mock.update.mockImplementationOnce(async fn => { const draft = structuredClone(mock.S); fn(draft); await Promise.resolve(); throw failure })
  render(); await upload(); await confirm()
  expect(mock.S).toEqual(before); expect(mock.update).toHaveBeenCalledOnce(); expect(close).not.toHaveBeenCalled()
  expect(host.querySelector('[role="alert"] p').textContent).toContain('storage quota')
  const details = host.querySelector('.routine-exchange-diagnostics').textContent
  expect(details).toContain('resources-write'); expect(details).toContain('tgym-profile'); expect(details).toContain('media:anonymous'); expect(details).toContain('QuotaExceededError')
  expect(JSON.parse(host.querySelector('.routine-exchange-diagnostics pre').textContent).failures[1].stack).toBe(cause.stack || '')
  expect(button('Cancel import').disabled).toBe(false)
  await saveAndSettle(button('Retry import'))
  if (host.querySelector('[data-step=success]')) act(() => button('View routines').click())
  expect(mock.S.routines).toHaveLength(2); expect(mock.update).toHaveBeenCalledTimes(2); expect(close).toHaveBeenCalledOnce()
})

it('requires acknowledgement of file-level legacy resource warnings and cancellation leaves the profile unchanged', async () => {
  mock.read.mockResolvedValue({ data: createRoutineExchange(mock.S), errors: [], warnings: [{ sheet: 'Catálogo', row: 2, field: 'definition', message: 'Legacy media cannot be recovered; export the original file again.' }] })
  const before = structuredClone(mock.S)
  render(); await upload(); expect(host.textContent).not.toContain('Legacy media cannot be recovered')
  const conflict = [...host.querySelectorAll('select')].find(el => el.querySelector('option[value="copy"]')); change(conflict, 'copy')
  expect(host.textContent).toContain('Legacy media cannot be recovered')
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
  expect(host.textContent).not.toContain('Review routines'); expect(mock.update).not.toHaveBeenCalled()
  act(() => root.unmount()); root = createRoot(host); render(); await upload(); expect(host.textContent).toContain('Review routines')
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
  await act(() => button('Confirm import').click())
  act(() => { button('Confirm import').click(); button('Confirm import').click() })
  expect(mock.update).not.toHaveBeenCalled(); expect(mock.S).toEqual(before); expect(close).not.toHaveBeenCalled()
  expect(host.querySelector('[role="status"]').textContent).toContain('Saving your selected routines…')
  expect(button('Cancel')).toBeUndefined(); expect(button('Cancel import')).toBeUndefined(); expect(button('Done')).toBeUndefined()
  expect(host.querySelector('progress').hasAttribute('value')).toBe(false)
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,25))})
  expect(mock.update).toHaveBeenCalledOnce()
  await act(async () => finish())
  expect(host.querySelector('[data-step=success]')).not.toBeNull()
  act(() => button('View routines').click())
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
  const unit = host.querySelector('input[aria-label="Convert weights to lb"]'); expect(unit.checked).toBe(true)
  const schedule = [...host.querySelectorAll('label')].find(label => label.textContent === 'Apply imported schedule (preserves other routines)').querySelector('input')
  act(() => { schedule.click(); host.querySelector('input[aria-label="I accept these adaptations for this import"]').click() })
  await confirm()
  act(() => button('Back').click())
  expect(mock.S).toEqual(before); expect(unit.checked).toBe(true); expect(schedule.checked).toBe(true)
  expect(host.querySelector('input[aria-label="I accept these adaptations for this import"]').checked).toBe(true)
  act(() => button('Cancel import').click())
  expect(mock.S).toEqual(before); expect(close).toHaveBeenCalledOnce()
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
  await confirm()
  expect(mock.S.routines.find(r => r.id === 'lb-source').ex[0].weight).toBe(10)
})

it('localizes Spanish adaptation and quota recovery messages without changing prescription meaning', async () => {
  mock.es = true
  const source = structuredClone(mock.S); source.routines[0].id = 'incoming'; source.routines[0].name = 'Incoming'; source.routineOrder = ['incoming']; source.routines[0].ex[0].reps = 12; source.effort = 'rpe'; source.deload = { on: true, startDate: '2026-10-01', every: 4, deloadWeeks: 1 }
  mock.read.mockResolvedValue({ data: createRoutineExchange(source), errors: [] }); mock.update.mockImplementationOnce(() => { throw new DOMException('The quota has been exceeded.', 'QuotaExceededError') })
  render(); await upload()
  expect(host.textContent).toContain('La ejecución del deload difiere en este dispositivo.')
  expect(host.textContent).toContain('La escala de esfuerzo difiere (RPE → Ninguno).')
  expect(host.textContent).not.toContain('Deload is enabled'); expect(host.textContent).not.toContain('Destination preferences remain unchanged')
  act(() => host.querySelector('input[aria-label="Acepto estas adaptaciones para esta importación"]').click())
  await confirm()
  expect(host.querySelector('[role="alert"] p').textContent).toContain('se superó la cuota de almacenamiento de TGym')
  expect(button('Reintentar importación')).toBeDefined(); expect(button('Cancelar importación')).toBeDefined()
  expect(host.querySelector('.routine-exchange-diagnostics summary').textContent).toBe('Detalles técnicos')
  expect(mock.S.effort).toBeUndefined(); expect(mock.S.deload).toBeUndefined()
})

it('offers JSON and Excel picking plus a direct template download without changing the profile', async () => {
  const before=structuredClone(mock.S);render()
  expect(host.querySelector('input[type=file]').accept).toContain('.xlsx,.json')
  await act(async()=>button('Download Excel template').click())
  expect(mock.build).toHaveBeenCalledWith(mock.S,[],'xlsx',{template:true})
  expect(mock.save).not.toHaveBeenCalled()
  await act(async()=>button('Download').click())
  expect(mock.save).toHaveBeenCalledOnce();expect(mock.S).toEqual(before);expect(mock.update).not.toHaveBeenCalled()
})

it('keeps the save bounded when a background browser stops supplying animation frames',async()=>{
  vi.stubGlobal('requestAnimationFrame',()=>1)
  const source=structuredClone(mock.S);source.routines[0].id='background';source.routines[0].name='Background';source.routines[0].ex[0].reps=12;source.routineOrder=['background']
  mock.read.mockResolvedValue({data:createRoutineExchange(source),errors:[]});render();await upload();act(()=>button('Continue').click())
  await act(async()=>{button('Import 1 routines').click();await new Promise(resolve=>setTimeout(resolve,125))})
  expect(mock.update).toHaveBeenCalledOnce();expect(host.querySelector('[data-step=success]')).not.toBeNull()
  expect(mock.S.routines.map(r=>r.id)).toEqual(['r','background'])
})

it('retains the chosen copy when a controlled select restores its DOM value before a queued updater runs',async()=>{
  render();await upload()
  const conflict=host.querySelector('select[aria-label="Conflict: Routine one"]')
  expect(conflict.value).toBe('keep')
  act(()=>{
    conflict.value='replace';conflict.dispatchEvent(new Event('change',{bubbles:true}))
    conflict.value='copy';conflict.dispatchEvent(new Event('change',{bubbles:true}))
    conflict.value='keep'
  })
  render()
  expect(host.querySelector('select[aria-label="Conflict: Routine one"]').value).toBe('copy')
  expect(button('Continue').disabled).toBe(false)
  await confirm();expect(mock.S.routines).toHaveLength(2)
})

it('shows no irrelevant unit, schedule or adaptation decisions for a matching ordinary v2 file', async () => {
  const source=structuredClone(mock.S);source.routines[0].id='fresh';source.routines[0].name='Fresh';source.routines[0].ex[0].reps=12;source.routineOrder=['fresh']
  mock.read.mockResolvedValue({data:createRoutineExchange(source),errors:[]});render();await upload()
  expect(host.querySelector('input[aria-label^="Convert weights"]')).toBeNull()
  expect(host.querySelector('input[aria-label="Apply imported schedule (preserves other routines)"]')).toBeNull()
  expect(host.querySelector('input[aria-label="I accept these adaptations for this import"]')).toBeNull()
  expect(button('Continue').disabled).toBe(false)
  act(()=>button('Deselect all').click())
  expect(button('Continue').disabled).toBe(true);expect(host.querySelector('[role=alert]').textContent).toContain('Select at least one routine')
  expect(mock.update).not.toHaveBeenCalled()
})

it('imports only selected routines and their custom exercises while back navigation preserves the selection', async () => {
  Object.assign(mock.S,{theme:'light',workouts:[{id:'history',entries:[]}],active:{id:'active',entries:[]}})
  const source=structuredClone(mock.S);source.customEx=[{id:'custom-source',n:'Source custom',custom:true,bp:'back',eq:'cable',tg:'lats',mg:'back',img:'https://example.com/custom.png'}]
  source.routines=[{id:'first',name:'First',ex:[{id:CATALOGUE[0].id,sets:2,reps:12,weight:20}]},{id:'second',name:'Second',ex:[{id:'custom-source',sets:3,reps:15,weight:30}]}];source.routineOrder=['first','second'];source.week={};source.dayPlan={}
  mock.read.mockResolvedValue({data:createRoutineExchange(source),errors:[]});const before=structuredClone(mock.S);render();await upload()
  act(()=>host.querySelector('input[aria-label="Include Second"]').click())
  act(()=>button('Continue').click());expect(host.querySelector('[data-step=import]')).not.toBeNull();expect(button('Import 1 routines')).toBeDefined()
  act(()=>button('Back').click());expect(host.querySelector('input[aria-label="Include Second"]').checked).toBe(false)
  act(()=>button('Back').click());expect(host.querySelector('[data-step=file]')).not.toBeNull()
  act(()=>button('Continue').click());expect(host.querySelector('input[aria-label="Include Second"]').checked).toBe(false)
  await confirm()
  expect(mock.S.routines.map(r=>r.id)).toEqual(['r','first']);expect(mock.S.customEx).toEqual(before.customEx)
  expect(mock.S.workouts).toEqual(before.workouts);expect(mock.S.active).toEqual(before.active);expect(mock.S.theme).toBe('light')
})

it.each(['routine-note','exercise-note','null-exercise','null-catalog','object-catalog','text-catalog'])('keeps malformed %s recoverable before rendering any unsafe prescription value',async kind=>{
  const data=createRoutineExchange(mock.S)
  if(kind==='routine-note')data.routines[0].note={bad:'value'}
  if(kind==='exercise-note')data.routines[0].ex[0].note={bad:'value'}
  if(kind==='null-exercise')data.routines[0].ex.push(null)
  if(kind==='null-catalog')data.catalog.push(null)
  if(kind==='object-catalog')data.catalog={bad:'value'}
  if(kind==='text-catalog')data.catalog='bad'
  mock.read.mockResolvedValue({data,errors:[]});render();await upload()
  expect(host.querySelector('[role=alert]')).not.toBeNull();expect(button('Continue').disabled).toBe(true)
  expect(host.querySelectorAll('.routine-exchange-series')).toHaveLength(0)
  expect(button('Change file')).toBeDefined();expect(mock.update).not.toHaveBeenCalled()
})
