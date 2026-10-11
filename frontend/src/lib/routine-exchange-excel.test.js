import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { CATALOGUE } from './exercises.js'
import { createRoutineExchange, createRoutineWorkbook, parseRoutineWorkbook, validateRoutineExchange, routineExchangeRows } from './routine-exchange.js'

const id = CATALOGUE[0].id
const state = (ex = [{ id, sets: 2, reps: 8, weight: 20 }]) => ({ unit: 'kg', restSec: 90, step: 2.5, backoffRepsMode: 'same', routines: [{ id: 'r', name: 'Prueba de acentos y fuerza', ex }], customEx: [], week: { 0: [], 1: ['r'] }, dayPlan: {}, routineOrder: ['r'] })
const parse = async (S, edit) => {
  const book = await createRoutineWorkbook(createRoutineExchange(S))
  edit?.(book)
  return parseRoutineWorkbook(await book.xlsx.writeBuffer())
}

describe('Excel routine exchange regressions', () => {
  it('accepts ungrouped local decimal strings without treating missing loads as zero', async () => {
    const result = await parse(state(), book => {
      for (const row of [2, 3]) {
        book.getWorksheet('Series').getCell(`F${row}`).value = '22,5'
        book.getWorksheet('Series').getCell(`H${row}`).value = '1,5'
        book.getWorksheet('Series').getCell(`I${row}`).value = '2.5'
      }
    })
    expect(result.errors).toEqual([])
    expect(result.data.routines[0].ex[0]).toMatchObject({ weight: 22.5, targetRirMin: 1.5, targetRirMax: 2.5 })
    const blank = await parse(state(), book => { for (const row of [2, 3]) book.getWorksheet('Series').getCell(`F${row}`).value = '' })
    expect(blank.errors).toEqual([])
    expect(blank.data.routines[0].ex[0]).not.toHaveProperty('weight')
  })
  it('retains inherited Back-off rules and rests after an unrelated RIR edit', async () => {
    const S = state([{ id, sets: 3, reps: 8, weight: 100, setScheme: 'topback', topSets: 1, backoffSets: 2, topRepsMin: 6, topRepsMax: 8, autoBackoffReps: true }])
    const result = await parse(S, book => { book.getWorksheet('Series').getCell('H2').value = 1; book.getWorksheet('Series').getCell('I2').value = 2 })
    expect(result.errors).toEqual([])
    expect(result.data.routines[0].ex[0]).toMatchObject({ topRirMin: 1, topRirMax: 2 })
    expect(result.data.routines[0].ex[0]).not.toHaveProperty('backoffRepsMode')
    expect(result.data.routines[0].ex[0]).not.toHaveProperty('restSec')
  })
  it('does not collapse truly empty rows with whitespace into empty routines', async () => {
    const result = await parse(state(), book => { book.getWorksheet('Rutinas').getCell('B5').value = '   ' })
    expect(result.errors).toEqual([])
    expect(result.data.routines).toHaveLength(1)
  })
  it('returns sheet errors for invalid preservation metadata instead of throwing', async () => {
    const result = await parse(state(), book => { book.getWorksheet('_TGym').getCell('A1').value = '{"data":{"routines":42},"rows":{}}'; book.getWorksheet('_TGym').spliceRows(2, book.getWorksheet('_TGym').rowCount) })
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ sheet: '_TGym' })]))
  })
  it('supports repeated instances independently and applies only changed prescriptions', async () => {
    const S = state([{ id, sets: 1, reps: 8, weight: 20 }, { id, sets: 1, reps: 12, weight: 30 }])
    const result = await parse(S, book => { book.getWorksheet('Series').getCell('D3').value = 10; book.getWorksheet('Series').getCell('E3').value = 10 })
    expect(result.errors).toEqual([])
    expect(result.data.routines[0].ex[0]).toEqual(S.routines[0].ex[0])
    expect(result.data.routines[0].ex[1]).toMatchObject({ id, reps: 10, weight: 30 })
    expect(result.data.routines[0].ex[1]).not.toHaveProperty('restSec')
  })
  it('exports inherited rules as visible effective targets without overwriting legacy offset exceptions', () => {
    const data = createRoutineExchange(state([{ id, sets: 3, reps: 8, weight: 100, setScheme: 'topback', topSets: 1, backoffSets: 2, backoffRepOffset: 4, backoffRepsOverride: true }]))
    const rows = routineExchangeRows(data).Series
    expect(rows[1].slice(3, 5)).toEqual([12, 12])
    expect(rows[1][12]).toBe('legacy:4')
  })
  it('rejects ambiguous grouped numeric text and nontext identifiers at concrete fields', async () => {
    const result = await parse(state(), book => {
      for (const row of [2, 3]) book.getWorksheet('Series').getCell(`F${row}`).value = '1,234.5'
    })
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ sheet: 'Series', field: 'Peso' })]))
    const nontext = await parse(state(), book => { book.getWorksheet('Rutinas').getCell('A2').value = 10 })
    expect(nontext.errors).toEqual(expect.arrayContaining([expect.objectContaining({ sheet: 'Rutinas', field: 'ID' })]))
  })
  it('authors advanced configurations from an empty template without relying on hidden prescriptions', async () => {
    const S = { ...state(), routines: [], routineOrder: [], week: {} }
    const data = createRoutineExchange(S), book = await createRoutineWorkbook(data)
    book.getWorksheet('Rutinas').getRow(2).values = ['r1', 'Día básico', 1, '{"1":0}', '{}', 'Nota con = literal', 'double', 70, 25, 5, 100, '{"emoji":"barbell"}']
    book.getWorksheet('Ejercicios de rutina').getRow(2).values = ['i1', 'r1', data.catalog[0].selector, 1, '', '=texto literal', 'reps', false, false, '', 2.5, false, true, false, '', '', '{"type":"dropset","count":2,"pct":20}', '{"afterRestSec":15}']
    book.getWorksheet('Series').getRow(2).values = ['i1', 1, 'Working', 6, 8, 20, 'kg', 1, 2, '', '', '', '', '', '', '', '']
    const result = await parseRoutineWorkbook(await book.xlsx.writeBuffer())
    expect(result.errors).toEqual([])
    expect(validateRoutineExchange(result.data, S).errors).toEqual([])
    expect(result.data.routines[0]).toMatchObject({ prog: 'double', restSec: 70, warmupRestSec: 25, supersetMoveRestSec: 5, supersetRoundRestSec: 100, emoji: 'barbell' })
    expect(result.data.routines[0].ex[0]).toMatchObject({ sets: 1, reps: 8, repsMin: 6, inc: 2.5, strictReps: true, bodyweight: false, intensifier: { type: 'dropset', count: 2, pct: 20 }, afterRestSec: 15, note: '=texto literal' })
    expect(result.data.routines[0].ex[0]).not.toHaveProperty('restSec')
  })
  it('uses real expandable tables, numeric validation, frozen identities and literal strings', async () => {
    const S = state(); S.routines[0].name = '=HYPERLINK("external")'
    const book = await createRoutineWorkbook(createRoutineExchange(S))
    expect(book.getWorksheet('Rutinas').getTable('TGymRoutines')).toBeDefined()
    expect(book.getWorksheet('Series').getTable('TGymSets')).toBeDefined()
    expect(book.getWorksheet('Ejercicios de rutina').views[0]).toMatchObject({ state: 'frozen', xSplit: 3, ySplit: 1 })
    expect(book.getWorksheet('Series').dataValidations.model['H2:I10001']).toMatchObject({ type: 'decimal', formulae: [0, 10] })
    const parsed = await parseRoutineWorkbook(await book.xlsx.writeBuffer())
    expect(parsed.data.routines[0].name).toBe(S.routines[0].name)
    expect(parsed.errors).toEqual([])
  })
  it('accepts older v1 headers without deleting optional advanced values', async () => {
    const S = state(); S.routines[0].prog = 'double'; S.routines[0].ex[0].inc = 5; S.routines[0].ex[0].intensifier = { type: 'restpause', totalReps: 12, restSec: 15 }
    const parsed = await parse(S, book => {
      const routine = book.getWorksheet('Rutinas'), exercises = book.getWorksheet('Ejercicios de rutina')
      routine.removeTable('TGymRoutines'); exercises.removeTable('TGymRoutineExercises')
      routine.eachRow(row => { for (let c = 7; c <= 12; c++) row.getCell(c).value = null })
      exercises.eachRow(row => { for (let c = 11; c <= 18; c++) row.getCell(c).value = null })
    })
    expect(parsed.errors).toEqual([])
    expect(parsed.data.routines).toEqual(S.routines)
  })
  it('refreshes derived Back-off values after changing Top without forcing manual formulas', async () => {
    const S = state([{ id, sets: 3, reps: 8, weight: 100, setScheme: 'topback', topSets: 1, backoffSets: 2 }])
    const parsed = await parse(S, book => { book.getWorksheet('Series').getCell('D2').value = 10; book.getWorksheet('Series').getCell('E2').value = 10; book.getWorksheet('Series').getCell('F2').value = 110 })
    expect(parsed.errors).toEqual([])
    const rows = routineExchangeRows(parsed.data).Series
    expect(rows[1].slice(3, 6)).toEqual([10, 10, 100])
    expect(parsed.data.routines[0].ex[0]).not.toHaveProperty('backoffRepsMode')
  })
  it('edits a generic option without changing unrelated represented fields and rejects duplicated identities', async () => {
    const parsed = await parse(state(), book => { book.getWorksheet('Ejercicios de rutina').getCell('R2').value = '{"afterRestSec":0,"tempo":"3-0-1"}' })
    expect(parsed.errors).toEqual([])
    expect(parsed.data.routines[0].ex[0]).toMatchObject({ afterRestSec: 0, tempo: '3-0-1', reps: 8, weight: 20 })
    const bad = await parse(state(), book => { book.getWorksheet('Ejercicios de rutina').getCell('R2').value = '{"id":"other"}' })
    expect(bad.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'Configuración (JSON)' })]))
  })
  it('preserves both Back-off modes, independent ranges, warmups, and lb loads across serialization', async () => {
    const S = state([
      { id, sets: 3, reps: 8, weight: 100, setScheme: 'topback', topSets: 1, backoffSets: 2, backoffRepsMode: 'increased', backoffRepsOverride: true, warmupSets: 2, side: true, repsPerSide: false },
      { id, sets: 3, reps: 8, weight: 100, setScheme: 'topback', topSets: 1, backoffSets: 2, backoffRepsMode: 'same', autoBackoffReps: false, backoffRepsMin: 10, backoffRepsMax: 12 }
    ])
    S.unit = 'lb'
    const parsed = await parse(S)
    expect(parsed.errors).toEqual([])
    expect(parsed.data.routines).toEqual(S.routines)
    expect(validateRoutineExchange(parsed.data, S).errors).toEqual([])
  })
  it('preserves long Unicode notes and multi-cell custom metadata in the actual ZIP and importer', async () => {
    const S = state(); S.customEx = [{ id: 'unicode-custom', n: 'Extensión personalizada', desc: '🏋️'.repeat(14000) }]
    S.routines[0].note = 'Rutina: café, áéíóú, ñ y 🏋️. '.repeat(700)
    S.routines[0].ex[0].note = 'Ejercicio: técnica, control y 🏋️. '.repeat(700)
    const book = await createRoutineWorkbook(createRoutineExchange(S))
    book.getWorksheet('_TGym').eachRow(row => {
      expect(row.getCell(1).value).not.toMatch(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/)
      expect(row.getCell(1).value.length).toBeLessThanOrEqual(30000)
    })
    const bytes = await book.xlsx.writeBuffer()
    // JSZip is ExcelJS's existing ZIP dependency; inspect bytes independently of its importer.
    const require = createRequire(import.meta.url), JSZip = createRequire(require.resolve('exceljs'))('jszip')
    const zip = await JSZip.loadAsync(bytes), xmlBytes = await zip.file('xl/sharedStrings.xml').async('uint8array')
    const xml = new TextDecoder('utf-8', { fatal: true }).decode(xmlBytes)
    expect(xml).not.toContain('\uFFFD')
    const result = await parseRoutineWorkbook(bytes)
    expect(result.errors).toEqual([])
    expect(result.data.routines[0].note === S.routines[0].note).toBe(true)
    expect(result.data.routines[0].ex[0].note === S.routines[0].ex[0].note).toBe(true)
    expect(result.data.catalog.find(ex => ex.id === 'unicode-custom').definition.desc === S.customEx[0].desc).toBe(true)
  })
  it('reports Excel cell limits before exporting a file that needs repair', async () => {
    const S = state(); S.routines[0].note = 'a'.repeat(32768)
    await expect(createRoutineWorkbook(createRoutineExchange(S))).rejects.toThrow(/Rutinas, row 2, Notas.*32767.*JSON/)
  })
})
