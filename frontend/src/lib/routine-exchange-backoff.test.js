import { describe, expect, it } from 'vitest'
import { CATALOGUE } from './exercises.js'
import { repBounds, withBackoffRepsMode } from './training-plan.js'
import { applyRoutineExchange, createRoutineExchange, createRoutineWorkbook, parseRoutineWorkbook, routineExchangeRows, validateRoutineExchange } from './routine-exchange.js'

const id = CATALOGUE[0].id
const cfg = extra => ({ id, sets: 3, reps: 6, weight: 100, setScheme: 'topback', topSets: 1, backoffSets: 2, topRepsMin: 4, topRepsMax: 6, backoffPct: 10, ...extra })
const state = (ex, mode = 'increased') => ({ unit: 'kg', backoffRepsMode: mode, restSec: 90, routines: [{ id: 'r', name: 'Reglas Back-off', ex }], routineOrder: ['r'], customEx: [], week: {}, dayPlan: {} })
const target = (mode = 'increased') => ({ ...state([], mode), routines: [], routineOrder: [], workouts: [{ id: 'history', entries: [] }], active: { id: 'active', entries: [] } })
const roundtrip = async (S, edit) => {
  const book = await createRoutineWorkbook(createRoutineExchange(S))
  edit?.(book)
  return parseRoutineWorkbook(await book.xlsx.writeBuffer())
}
const editRule = (book, rule) => { for (const row of [3, 4]) book.getWorksheet('Series').getCell(`M${row}`).value = rule }
const backoffRows = data => routineExchangeRows(data).Series.filter(row => row[2] === 'Back-off')

describe('routine Back-off intent across JSON, Excel and execution', () => {
  it.each([
    ['same', { backoffRepsMode: 'increased', backoffRepOffset: 2 }],
    ['increased', { backoffRepsMode: 'same', backoffRepOffset: 0 }],
    ['same', { backoffRepOffset: 4 }],
    ['increased', { backoffRepsOverride: false, backoffRepsMode: 'same' }]
  ])('keeps old %s profile snapshots inherited without rewriting their fields', async (mode, snapshot) => {
    const S = state([cfg(snapshot)], mode), data = createRoutineExchange(S)
    const checked = validateRoutineExchange(JSON.stringify(data), target(mode))
    expect(checked.errors).toEqual([])
    expect(checked.data.routines[0].ex[0]).toEqual(S.routines[0].ex[0])
    const rows = backoffRows(data), expected = mode === 'same' ? [4, 6] : [6, 8]
    expect(rows.map(row => row.slice(3, 5))).toEqual([expected, expected])
    expect(rows.map(row => row[12])).toEqual(['inherit', 'inherit'])
    const parsed = await roundtrip(S)
    expect(parsed.errors).toEqual([])
    expect(parsed.data.routines).toEqual(S.routines)
  })

  it.each([
    ['same', 'increased', { backoffRepsMode: 'same' }, [4, 6]],
    ['increased', 'same', { backoffRepsMode: 'increased' }, [6, 8]],
    ['legacy:4', 'same', { backoffRepOffset: 4 }, [8, 10]]
  ])('explicit Excel rule %s survives import, execution and both reexports', async (rule, profile, exception, expected) => {
    const S = state([cfg()], profile), parsed = await roundtrip(S, book => editRule(book, rule))
    expect(parsed.errors).toEqual([])
    const importedCfg = parsed.data.routines[0].ex[0]
    expect(importedCfg).toMatchObject({ backoffRepsOverride: true, ...exception })
    if (rule.startsWith('legacy:')) expect(importedCfg).not.toHaveProperty('backoffRepsMode')
    const before = target(profile), checked = validateRoutineExchange(parsed.data, before)
    expect(checked.errors).toEqual([])
    const imported = applyRoutineExchange(before, checked)
    expect(imported.workouts).toEqual(before.workouts)
    expect(imported.active).toEqual(before.active)
    expect(repBounds(withBackoffRepsMode(imported.routines[0].ex[0], imported), 'backoff')).toEqual({ min: expected[0], max: expected[1] })
    const json = JSON.stringify(createRoutineExchange(imported)), jsonChecked = validateRoutineExchange(json, target(profile))
    expect(jsonChecked.errors).toEqual([])
    expect(jsonChecked.data.routines[0].ex[0]).toEqual(importedCfg)
    const again = await roundtrip(imported)
    expect(again.errors).toEqual([])
    expect(again.data.routines[0].ex[0]).toEqual(importedCfg)
    expect(backoffRows(again.data).map(row => row.slice(3, 5))).toEqual([expected, expected])
    expect(backoffRows(again.data).map(row => row[12])).toEqual([rule, rule])
  })

  it('returns an explicit rule to inheritance and removes its obsolete snapshot', async () => {
    const S = state([cfg({ backoffRepsOverride: true, backoffRepsMode: 'same', backoffRepOffset: 0 })]), parsed = await roundtrip(S, book => editRule(book, 'inherit'))
    expect(parsed.errors).toEqual([])
    const e = parsed.data.routines[0].ex[0]
    for (const key of ['backoffRepsOverride', 'backoffRepsMode', 'backoffRepOffset']) expect(e).not.toHaveProperty(key)
    expect(backoffRows(parsed.data)[0].slice(3, 5)).toEqual([6, 8])
  })

  it('does not reinterpret unchanged old v1 Series snapshots after an unrelated visible edit', async () => {
    const S = state([cfg({ backoffRepsMode: 'same', backoffRepOffset: 0 })]), parsed = await roundtrip(S, book => {
      const metadata = book.getWorksheet('_TGym'), saved = JSON.parse(metadata.getColumn(1).values.filter(value => typeof value === 'string').join(''))
      for (const row of saved.rows.Series.filter(row => row[2] === 'Back-off')) { row[3] = 4; row[4] = 6; row[12] = 'same' }
      for (const row of [3, 4]) { const series = book.getWorksheet('Series'); series.getCell(`D${row}`).value = 4; series.getCell(`E${row}`).value = 6; series.getCell(`M${row}`).value = 'same' }
      const text = JSON.stringify(saved), chunks = []
      for (let start = 0; start < text.length; start += 30000) chunks.push([text.slice(start, start + 30000)])
      metadata.spliceRows(1, metadata.rowCount, ...chunks)
      book.getWorksheet('Series').getCell('H2').value = 1
      book.getWorksheet('Series').getCell('I2').value = 2
    })
    expect(parsed.errors).toEqual([])
    expect(parsed.data.routines[0].ex[0]).toMatchObject({ backoffRepsMode: 'same', backoffRepOffset: 0, topRirMin: 1, topRirMax: 2 })
    expect(parsed.data.routines[0].ex[0]).not.toHaveProperty('backoffRepsOverride')
    expect(backoffRows(parsed.data)[0].slice(3, 5)).toEqual([6, 8])
    expect(backoffRows(parsed.data)[0][12]).toBe('inherit')
  })

  it('can author explicit rules without preservation metadata while inherited rules stay absent', async () => {
    const S = state([cfg(), cfg()]), book = await createRoutineWorkbook(createRoutineExchange(S))
    book.removeWorksheet('_TGym')
    editRule(book, 'same')
    for (const row of [3, 4]) { book.getWorksheet('Series').getCell(`D${row}`).value = 4; book.getWorksheet('Series').getCell(`E${row}`).value = 6 }
    const parsed = await parseRoutineWorkbook(await book.xlsx.writeBuffer())
    expect(parsed.errors).toEqual([])
    expect(validateRoutineExchange(parsed.data, target()).errors).toEqual([])
    expect(parsed.data.routines[0].ex[0]).toMatchObject({ backoffRepsOverride: true, backoffRepsMode: 'same' })
    expect(parsed.data.routines[0].ex[1]).not.toHaveProperty('backoffRepsOverride')
    expect(parsed.data.routines[0].ex[1]).not.toHaveProperty('backoffRepsMode')
    expect(backoffRows(parsed.data).map(row => row.slice(3, 5))).toEqual([[4, 6], [4, 6], [6, 8], [6, 8]])
  })

  it('keeps manual ranges and per-side legacy offsets distinct from inherited automatic targets', async () => {
    const S = state([
      cfg({ backoffRepsOverride: true, backoffRepOffset: 4, side: true, repsPerSide: false }),
      cfg({ autoBackoffReps: false, backoffRepsMin: 10, backoffRepsMax: 12, backoffRepsMode: 'same' })
    ], 'same'), parsed = await roundtrip(S)
    expect(parsed.errors).toEqual([])
    expect(parsed.data.routines).toEqual(S.routines)
    expect(backoffRows(parsed.data).map(row => row.slice(3, 5))).toEqual([[8, 10], [8, 10], [10, 12], [10, 12]])
  })

  it.each([{ backoffRepsOverride: 'true' }, { backoffRepsOverride: true }, { backoffRepsOverride: true, backoffRepOffset: 0 }])('rejects invalid explicit JSON intent before applying it', invalid => {
    const S = state([cfg(invalid)]), before = target(), checked = validateRoutineExchange(createRoutineExchange(S), before)
    expect(checked.errors.some(error => error.field === 'backoffRepsOverride')).toBe(true)
    expect(() => applyRoutineExchange(before, checked)).toThrow()
    expect(before.routines).toEqual([])
  })

  it.each(['legacy:0', 'legacy:11', 'legacy:1.5'])('reports an invalid Excel Back-off rule %s', async rule => {
    const parsed = await roundtrip(state([cfg()]), book => editRule(book, rule))
    expect(parsed.errors).toEqual(expect.arrayContaining([expect.objectContaining({ sheet: 'Series', field: 'Regla Back-off' })]))
  })
})
