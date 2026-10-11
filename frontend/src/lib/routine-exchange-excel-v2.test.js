import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { CATALOGUE } from './exercises.js'
import { createRoutineExchange, createRoutineWorkbook, parseRoutineWorkbook, validateRoutineExchange, routineExchangeRows, buildRoutineExchangeFile, readRoutineExchangeFile, ROUTINE_EXCHANGE_MAX_BYTES } from './routine-exchange.js'

const id = CATALOGUE[0].id
const heavy = CATALOGUE.find(ex => ['upper legs', 'lower legs', 'back', 'hips', 'glutes'].includes(ex.bp)).id
const gif = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
const state = (ex = [{ id, sets: 2, reps: 8, weight: 20 }]) => ({ unit: 'kg', restSec: 75, strictReps: true, backoffRepsMode: 'same', routines: [{ id: 'r', name: 'Transferencia íntegra 🏋️', ex }], customEx: [], week: { 0: [], 1: ['r'] }, dayPlan: { '2026-10-14': [], '2026-10-15': ['r'] }, routineOrder: ['r'] })
const roundtrip = async (S, edit) => {
  const data = createRoutineExchange(S), book = await createRoutineWorkbook(data)
  edit?.(book, data)
  return { ...await parseRoutineWorkbook(await book.xlsx.writeBuffer()), source: data }
}
const metadata = book => JSON.parse(book.getWorksheet('_TGym').getColumn(1).values.slice(1).join(''))
const saveMetadata = (book, data) => {
  const sheet = book.getWorksheet('_TGym'), text = JSON.stringify(data), rows = []
  for (let start = 0; start < text.length; start += 30000) rows.push([text.slice(start, start + 30000)])
  sheet.spliceRows(1, sheet.rowCount, ...rows)
}

describe('portable format 2 Excel regressions', () => {
  it('explains source-only rules and the required custom preservation metadata in the downloadable workbook', async () => {
    const book = await createRoutineWorkbook(createRoutineExchange(state()))
    const guidance = new Map()
    book.getWorksheet('Instrucciones').eachRow(row => guidance.set(row.getCell(1).value, row.getCell(2).value))
    expect(guidance.get('Reglas del perfil')).toContain('las preferencias globales del receptor no cambian')
    expect(guidance.get('Reglas del perfil')).not.toContain('confirmar esa opción')
    expect(guidance.get('Compatibilidad')).toContain('el formato 2 bloquea la importación')
    expect(guidance.get('Compatibilidad')).toContain('El formato 1 requiere aceptar la advertencia')
  })
  it('reopens serialized files with complete source prescriptions, custom GIFs and repeated-instance relationships', async () => {
    const S = state([{ id: 'c', sets: 1, reps: 8, weight: 22.5, note: '=literal' }, { id: 'c', sets: 2, reps: 12, weight: 30, sg: 'pair' }, { id, sets: 2, reps: 10, sg: 'pair' }])
    S.customEx = [{ id: 'c', n: 'Duplicado con acentos', bp: 'back', eq: 'barbell', custom: true, img: gif, desc: 'Técnica 🏋️' }]
    S.exerciseAliases = { c: 'Mi apodo' }; S.exNotes = { c: 'Nota de biblioteca' }
    const result = await roundtrip(S)
    expect(result.errors).toEqual([]); expect(result.warnings).toEqual([])
    expect(result.data.routines).toEqual(result.source.routines)
    expect(result.data.catalog).toEqual(result.source.catalog)
    expect(result.data.week).toEqual(S.week); expect(result.data.dayPlan).toEqual(S.dayPlan)
    expect(result.data.routines[0].ex[0]).toMatchObject({ mode: 'reps', restSec: 75, strictReps: true, loadingStep: 5 })
    expect(result.data.catalog.find(ex => ex.id === 'c')).not.toHaveProperty('img')
    expect(result.data.catalog.find(ex => ex.id === 'c').definition.img).toBe(gif)
    expect(routineExchangeRows(result.data)['Ejercicios de rutina'].map(row => row[0])).toEqual(['r:1', 'r:2', 'r:3'])
  })
  it('detects missing custom preservation definitions instead of silently discarding their media', async () => {
    const S = state([{ id: 'c', sets: 1, reps: 8 }]); S.customEx = [{ id: 'c', n: 'Custom', img: gif, custom: true }]
    const result = await roundtrip(S, book => book.removeWorksheet('_TGym'))
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ sheet: 'Catálogo', field: 'Definición personalizada', message: expect.stringContaining('export JSON') })]))
    const legacy = await roundtrip(S, book => { const saved = metadata(book); saved.data.tgym_routine_exchange = 1; delete saved.metadataVersion; book.getWorksheet('Instrucciones').getCell('B2').value = 1; saveMetadata(book, saved); book.removeWorksheet('_TGym') })
    expect(legacy.errors).toEqual([])
    expect(legacy.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ sheet: 'Catálogo', field: 'Definición personalizada' })]))
  })
  it.each([99, 1])('rejects metadata version %s that disagrees with the visible version 2', async version => {
    const result = await roundtrip(state(), book => { const saved = metadata(book); saved.metadataVersion = version; saveMetadata(book, saved) })
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ sheet: '_TGym' })]))
  })
  it('preserves rest-day markers without hidden metadata and reports contradictory assignments', async () => {
    const result = await roundtrip(state(), book => book.removeWorksheet('_TGym'))
    expect(result.errors).toEqual([]); expect(result.data.week).toEqual({ 0: [], 1: ['r'] }); expect(result.data.dayPlan).toEqual(state().dayPlan)
    const invalid = await roundtrip(state(), book => { book.getWorksheet('Rutinas').getCell('D2').value = '{"0":0}' })
    expect(invalid.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'week', message: expect.stringContaining('marked as rest') })]))
  })
  it('binds exercise selection to the expandable catalogue table without identity formulas', async () => {
    const result = await buildRoutineExchangeFile({ ...state(), customEx: [{ id: 'unused', n: 'Unused', custom: true, img: gif }] }, [], 'xlsx', { template: true })
    expect(result.name).toContain('routine-template-v2')
    const require = createRequire(import.meta.url), Excel = require('exceljs'), book = new Excel.Workbook()
    await book.xlsx.load(await result.blob.arrayBuffer())
    expect(book.getWorksheet('Ejercicios de rutina').getCell('C2').dataValidation.formulae).toEqual(['INDIRECT("TGymCatalogue[Selector]")'])
    // ExcelJS exposes loaded table structure but does not reconstruct its editable
    // row cache. Extend the generated table, then reopen its actual saved bytes.
    const extended = await createRoutineWorkbook(metadata(book).data), catalogue = extended.getWorksheet('Catálogo'), table = catalogue.getTable('TGymCatalogue'), count = catalogue.rowCount
    table.addRow(['another', 'Extended', '', true, 'Extended [another]', '']); table.commit()
    expect(catalogue.rowCount).toBe(count + 1)
    expect(catalogue.getCell(`E${count + 1}`).value).toBe('Extended [another]')
    const reopened = new Excel.Workbook(); await reopened.xlsx.load(await extended.xlsx.writeBuffer())
    expect(reopened.getWorksheet('Catálogo').getTable('TGymCatalogue').table.tableRef).toBe(`A1:F${count + 1}`)
    expect(metadata(book).data.catalog.find(ex => ex.id === 'unused').definition.img).toBe(gif)
    expect(catalogue.getCell('E2').type).not.toBe(6)
  })
  it.each(['1,234', '1.234'])('rejects ambiguous numeric text %s with an actionable field error', async value => {
    const result = await roundtrip(state(), book => { for (const row of [2, 3]) book.getWorksheet('Series').getCell(`F${row}`).value = value })
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ sheet: 'Series', field: 'Peso', message: expect.stringContaining('1.2340') })]))
  })
  it.each([['22,5', 22.5], ['1.2340', 1.234], [1.234, 1.234]])('accepts unambiguous decimal %s as %s', async (value, expected) => {
    const result = await roundtrip(state(), book => { for (const row of [2, 3]) book.getWorksheet('Series').getCell(`F${row}`).value = value })
    expect(result.errors).toEqual([]); expect(result.data.routines[0].ex[0].weight).toBe(expected)
  })
  it('uses the source loading grid separately from the progression increment', async () => {
    const S = state([{ id: heavy, sets: 3, reps: 8, weight: 100, inc: 7.5, setScheme: 'topback', topSets: 1, backoffSets: 2, backoffPct: 14 }])
    const result = await roundtrip(S, book => { book.getWorksheet('Series').getCell('F2').value = 110 })
    expect(result.errors).toEqual([])
    expect(result.data.routines[0].ex[0]).toMatchObject({ weight: 110, inc: 7.5, loadingStep: 5 })
    expect(routineExchangeRows(result.source).Series[1][5]).toBe(85)
    expect(routineExchangeRows(result.data).Series[1][5]).toBe(95)
  })
  it('exports actual Rest-pause activation and total reps while retaining ignored historical configuration', async () => {
    const S = state([{ id, sets: 3, warmupSets: 2, reps: 8, weight: 30, intensifier: { type: 'restpause', totalReps: 15, restSec: 15 } }])
    const result = await roundtrip(S)
    expect(result.errors).toEqual([]); expect(result.data.routines).toEqual(result.source.routines)
    expect(routineExchangeRows(result.data).Series.map(row => row.slice(1, 6))).toEqual([[1, 'Warm-up', 8, 8, 30], [2, 'Working', 15, 15, 30]])
    const changed = await roundtrip(S, book => { const sheet = book.getWorksheet('Series'); sheet.getCell('D2').value = 10; sheet.getCell('E2').value = 10; sheet.getCell('D3').value = 18; sheet.getCell('E3').value = 18; sheet.getCell('F3').value = '32,5' })
    expect(changed.errors).toEqual([])
    expect(changed.data.routines[0].ex[0]).toMatchObject({ sets: 3, warmupSets: 2, reps: 10, weight: 32.5, intensifier: { type: 'restpause', totalReps: 18, restSec: 15 } })
    expect(routineExchangeRows(changed.data).Series.map(row => row[5])).toEqual([32.5, 32.5])
    const bad = await roundtrip(S, book => { book.getWorksheet('Series').getRow(4).values = ['r:1', 3, 'Working', 15, 15, 30, 'kg', '', '', 75, '', '', '', '', '', '', ''] })
    expect(bad.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'Tipo', message: expect.stringContaining('Rest-pause requires') })]))
  })
  it('can author Rest-pause in a blank template without any preservation prescriptions', async () => {
    const S = { ...state(), routines: [], routineOrder: [], week: {}, dayPlan: {} }, book = await createRoutineWorkbook(createRoutineExchange(S, [], { fullCatalog: true }))
    book.removeWorksheet('_TGym')
    book.getWorksheet('Rutinas').getRow(2).values = ['r1', 'Nueva rutina', 1, '{}', '{}', '']
    book.getWorksheet('Ejercicios de rutina').getRow(2).values = ['i1', 'r1', `${CATALOGUE[0].n} [${id}]`, 1, '', '', 'reps', false, false, '', 2.5, false, true, false, '', '', '{"type":"restpause","totalReps":12,"restSec":15}', '{}']
    book.getWorksheet('Series').getRow(2).values = ['i1', 1, 'Warm-up', 8, 8, 20, 'kg', '', '', 25, '', '', '', '', '', '', '']
    book.getWorksheet('Series').getRow(3).values = ['i1', 2, 'Working', 12, 12, 20, 'kg', 1, 2, 75, '', '', '', '', '', '', '']
    const result = await parseRoutineWorkbook(await book.xlsx.writeBuffer())
    expect(result.errors).toEqual([])
    expect(result.data.routines[0].ex[0]).toMatchObject({ sets: 1, reps: 8, weight: 20, restSec: 75, warmupRestSec: 25, targetRirMin: 1, targetRirMax: 2 })
    expect(result.data.routines[0].ex[0]).not.toHaveProperty('warmupSets')
  })
  it('rejects excessive JSON and declared expanded Excel before generating or parsing them', async () => {
    const S = state(); S.routines[0].note = 'x'.repeat(ROUTINE_EXCHANGE_MAX_BYTES)
    await expect(buildRoutineExchangeFile(S, ['r'], 'json')).rejects.toThrow(/15 MiB/)
    await expect(createRoutineWorkbook(createRoutineExchange(S))).rejects.toThrow(/15 MiB/)
    await expect(readRoutineExchangeFile({ name: 'big.json', size: ROUTINE_EXCHANGE_MAX_BYTES + 1 })).rejects.toThrow(/15 MiB/)
    const book = await createRoutineWorkbook(createRoutineExchange(state())), bytes = new Uint8Array(await book.xlsx.writeBuffer()), view = new DataView(bytes.buffer)
    let end = bytes.length - 22; while (view.getUint32(end, true) !== 0x06054b50) end--
    view.setUint32(view.getUint32(end + 16, true) + 24, 129 * 1024 * 1024, true)
    await expect(parseRoutineWorkbook(bytes)).rejects.toThrow(/128 MiB/)
  })
  it('opens UTF-8 BOM JSON and reports a damaged archive or invalid JSON recoverably', async () => {
    const data = createRoutineExchange(state()), text = '\uFEFF' + JSON.stringify(data)
    expect((await readRoutineExchangeFile({ name: 'plan.json', size: text.length, text: async () => text })).data).toEqual(data)
    await expect(parseRoutineWorkbook(new Uint8Array([1, 2, 3]))).rejects.toThrow(/damaged/)
    await expect(readRoutineExchangeFile({ name: 'plan.json', size: 1, text: async () => '{' })).rejects.toThrow(/damaged or incomplete/)
  })
  it('rejects a ZIP CRC mismatch even when the XML itself remains valid', async () => {
    const book = await createRoutineWorkbook(createRoutineExchange(state())), bytes = new Uint8Array(await book.xlsx.writeBuffer()), view = new DataView(bytes.buffer)
    let end = bytes.length - 22; while (view.getUint32(end, true) !== 0x06054b50) end--
    const central = view.getUint32(end + 16, true)
    view.setUint32(central + 16, view.getUint32(central + 16, true) ^ 1, true)
    await expect(parseRoutineWorkbook(bytes)).rejects.toThrow(/damaged/)
    // This is the actual browser build selected by ExcelJS's package mapping.
    const require = createRequire(import.meta.url), BrowserExcel = require('exceljs/dist/exceljs.js')
    expect(require('exceljs/package.json').browser).toBe('./dist/exceljs.js')
    await expect(new BrowserExcel.Workbook().xlsx.load(bytes)).rejects.toThrow(/CRC32/)
  })
  it('reports physical row positions independently of per-routine ordering without storing them in the transfer', async () => {
    const S = state(); S.routines.push({ id: 'second', name: 'Second routine', ex: [{ id, sets: 1, reps: 10 }] }); S.routineOrder.push('second')
    const result = await roundtrip(S, book => {
      const sheet = book.getWorksheet('Ejercicios de rutina')
      sheet.getCell('A6').value = sheet.getCell('A3').value; sheet.getCell('A3').value = null
      for (let column = 2; column <= 18; column++) { sheet.getCell(6, column).value = sheet.getCell(3, column).value; sheet.getCell(3, column).value = null }
      sheet.getCell('R6').value = '{"loadingStep":-1}'
      book.getWorksheet('Series').getCell('H4').value = 3; book.getWorksheet('Series').getCell('I4').value = 1
    })
    expect(result.errors).toEqual([])
    expect(result.locations.routines.get('second')).toBe(3)
    expect(result.locations.exercises.get('second:1')).toBe(6)
    expect(result.locations.fields.get('second:1:loadingStep')).toEqual({ sheet: 'Ejercicios de rutina', row: 6, field: 'Configuración (JSON)' })
    expect(result.locations.fields.get('second:1:targetRirMin / targetRirMax')).toEqual({ sheet: 'Series', row: 4, field: 'RIR mín. / RIR máx.' })
    expect(result.locations.catalog.get(id)).toBe(2)
    expect(result.data).not.toHaveProperty('locations')
    const checked = validateRoutineExchange(result.data, { unit: 'kg', routines: [], customEx: [] }, { locations: result.locations })
    expect(checked.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ sheet: 'Ejercicios de rutina', row: 6, field: 'Configuración (JSON)' }),
      expect.objectContaining({ sheet: 'Series', row: 4, field: 'RIR mín. / RIR máx.' })
    ]))
  })
})
