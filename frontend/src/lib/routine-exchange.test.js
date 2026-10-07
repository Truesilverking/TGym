import { describe, expect, it } from 'vitest'
import { CATALOGUE } from './exercises.js'
import { createRoutineExchange, validateRoutineExchange, applyRoutineExchange, createRoutineWorkbook, parseRoutineWorkbook, readRoutineExchangeFile, routineExchangeRows, buildRoutineExchangeFile } from './routine-exchange.js'
import { routinePDFPages } from './routine-exchange-pdf.js'

const known = CATALOGUE[0].id
function fixture() {
  return { unit: 'kg', restSec: 90, strictReps: false, effort: 'rir', backoffRepsMode: 'same', restAdvanced: { warmup: 30, supersetMove: 0, supersetRound: 120 },
    customEx: [{ id: 'custom-a', n: 'Duplicate original', bp: 'upper legs', eq: 'body weight', custom: true, st: ['First instruction.'] }, { id: 'custom-b', n: 'Duplicate original', bp: 'back', custom: true }],
    exerciseAliases: { [known]: 'Bench nickname', 'custom-a': 'My custom alias' }, routineOrder: ['r2', 'r1'],
    routines: [{ id: 'r1', name: 'A very long routine name '.repeat(8), emoji: 'barbell', note: 'Routine note', restSec: 80, guideSlots: [{ source: 'guide', id: 'stable' }],
      ex: [{ id: known, sets: 3, reps: 8, repsMin: 6, weight: 100, warmupSets: 2, setScheme: 'topback', topSets: 1, backoffSets: 2, backoffPct: 10, topRepsMin: 6, topRepsMax: 8, autoBackoffReps: true, backoffRepsMode: 'increased', topRirMin: 1, topRirMax: 2, backoffRirMin: 2, backoffRirMax: 3, sg: 'ss1', note: 'Exercise note '.repeat(30), prog: 'double', inc: 2.5, strictReps: true },
        { id: 'custom-a', sets: 2, reps: 10, weight: 20, sg: 'ss1', side: true, repsPerSide: true, intensifier: { type: 'dropset', count: 2, pct: 20 }, note: 'Original note', setRestSec: [80, 70] }] },
      { id: 'r2', name: 'Duplicate original', emoji: 'clock', ex: [{ id: 'custom-b', mode: 'time', sets: 2, sec: 45, weight: 0, prog: 'time', inc: 5 }] }],
    week: { 0: [], 1: ['r2', 'r1'], 3: ['r1'] }, dayPlan: { '2026-10-10': ['r1', 'r2'], '2026-10-11': [] }, workouts: [{ id: 'history-preserved' }], active: { id: 'active-preserved' } }
}
const empty = () => ({ unit: 'kg', routines: [], routineOrder: [], customEx: [], exerciseAliases: {}, week: {}, dayPlan: {}, workouts: [{ id: 'old' }], active: { id: 'live' } })
async function roundtrip(S = fixture(), edit) { const data = createRoutineExchange(S), workbook = await createRoutineWorkbook(data); edit?.(workbook); return parseRoutineWorkbook(await workbook.xlsx.writeBuffer()) }

describe('routine exchange identities, validation and atomic import', () => {
  it('exports selected routines and their ordered schedule without user workout results', () => {
    const data = createRoutineExchange(fixture(), ['r1'])
    expect(data.routines.map(r => r.id)).toEqual(['r1']); expect(data.week[1]).toEqual(['r1'])
    expect(data.catalog.filter(ex => ex.custom)).toHaveLength(2)
    expect(data.workouts).toBeUndefined(); expect(data.active).toBeUndefined()
    expect(data.catalog.find(ex => ex.id === known).n).toBe(CATALOGUE[0].n)
  })
  it('JSON preserves all configuration, custom definition, aliases, schedule and order', () => {
    const S = fixture(), data = JSON.parse(JSON.stringify(createRoutineExchange(S))), check = validateRoutineExchange(data, empty())
    expect(check.errors).toEqual([]); expect(check.unresolved).toEqual([])
    const imported = applyRoutineExchange(empty(), check, { schedule: true, rules: true })
    expect(imported.routines).toEqual([S.routines[1], S.routines[0]])
    expect(imported.customEx).toEqual(S.customEx); expect(imported.exerciseAliases).toEqual(S.exerciseAliases)
    expect(imported.week).toEqual(S.week); expect(imported.dayPlan).toEqual(S.dayPlan); expect(imported.routineOrder).toEqual(S.routineOrder)
    expect(imported.backoffRepsMode).toBe('same'); expect(imported.workouts).toEqual([{ id: 'old' }]); expect(imported.active).toEqual({ id: 'live' })
  })
  it('requires explicit unknown-ID mapping and never resolves duplicate names by guessing', () => {
    const data = createRoutineExchange(fixture()); data.routines[0].ex[0].id = 'unknown'; data.catalog.push({ id: 'unknown', n: 'Duplicate original' })
    const before = empty(), check = validateRoutineExchange(data, before)
    expect(check.valid).toBe(false); expect(check.unresolved.map(ex => ex.id)).toEqual(['unknown'])
    expect(() => applyRoutineExchange(before, check)).toThrow(); expect(before.routines).toEqual([])
    const mapped = validateRoutineExchange(data, before, { exerciseMappings: { unknown: known } })
    expect(mapped.valid).toBe(true); expect(mapped.data.routines[0].ex[0].id).toBe(known)
  })
  it('requires every conflict decision and rejects invalid choices before changing anything', () => {
    const S = fixture(), data = createRoutineExchange(S); data.routines[0].name = 'Changed'; data.catalog.find(ex => ex.id === known).alias = 'New alias'
    const check = validateRoutineExchange(data, S), original = JSON.stringify(S)
    expect(check.conflicts.some(conflict => conflict.kind === 'alias')).toBe(true)
    expect(() => applyRoutineExchange(S, check)).toThrow(); expect(() => applyRoutineExchange(S, check, { conflicts: Object.fromEntries(check.conflicts.map(c => [c.key, 'garbage'])) })).toThrow()
    expect(JSON.stringify(S)).toBe(original)
    const result = applyRoutineExchange(S, check, { conflicts: Object.fromEntries(check.conflicts.map(c => [c.key, 'keep'])) })
    expect(result.routines).toEqual(S.routines); expect(result.exerciseAliases).toEqual(S.exerciseAliases)
  })
  it.each([
    data => { data.tgym_routine_exchange = 999 }, data => { data.routineOrder = ['r1', 'r1'] },
    data => { data.week[1] = 123 }, data => { data.dayPlan['2026-02-31'] = ['r1'] },
    data => { data.routines[1].ex[0].topRepsMin = 99 }, data => { data.routines[1].ex[0].backoffPct = 80 },
    data => { data.routines[1].ex[0].sg = 'orphan' }, data => { data.rules.strictReps = 'false' },
    data => { data.rules.restAdvanced.warmup = -1 }, data => { data.routines[1].ex[0].targetRir = NaN },
  ])('rejects invalid versions/types/ranges/references/rules', change => { const data = createRoutineExchange(fixture()); change(data); const checked = validateRoutineExchange(data, empty()); expect(checked.errors.length).toBeGreaterThan(0); expect(checked.valid).toBe(false) })
  it('supports old plan v1 without silently dropping unknown exercises', () => {
    const data = { framegym_plan: 1, routines: [{ id: 'legacy', name: 'Legacy', ex: [{ id: 'missing', sets: 2, reps: 8 }] }], week: { 1: 'legacy' } }
    const check = validateRoutineExchange(data, empty()); expect(check.data.convertedLegacy).toBe(true); expect(check.unresolved[0].id).toBe('missing'); expect(check.data.routines[0].ex).toHaveLength(1)
  })
  it('replaces imported schedule/order everywhere while preserving unrelated assignments', () => {
    const S = fixture(), data = createRoutineExchange(S)
    data.routineOrder = ['r1', 'r2']; data.week = { 5: ['r1', 'r2'] }; data.dayPlan = {}
    S.routines.push({ id: 'other', name: 'Other', ex: [] }); S.routineOrder.push('other'); S.week[1].push('other')
    const check = validateRoutineExchange(data, S), choices = Object.fromEntries(check.conflicts.map(conflict => [conflict.key, 'replace']))
    const imported = applyRoutineExchange(S, check, { conflicts: choices, schedule: true })
    expect(imported.routineOrder).toEqual(['other', 'r1', 'r2']); expect(imported.week[1]).toEqual(['other']); expect(imported.week[3]).toEqual([]); expect(imported.week[5]).toEqual(['r1', 'r2']); expect(imported.dayPlan['2026-10-10']).toEqual([])
    data.week = { 1: ['r1', 'r1'] }; expect(validateRoutineExchange(data, S).errors.some(error => /duplicate routine reference/.test(error.message))).toBe(true)
  })
  it('requires renewed review after relevant live data changes, while timer-only changes remain valid', () => {
    const S = fixture(), check = validateRoutineExchange(createRoutineExchange(S), S), choices = Object.fromEntries(check.conflicts.map(conflict => [conflict.key, 'replace']))
    S.active.clock = { elapsed: 12 }; S._ts = 999
    expect(() => applyRoutineExchange(S, check, { conflicts: choices })).not.toThrow()
    S.routines[0].name = 'Edited during preview'
    expect(() => applyRoutineExchange(S, check, { conflicts: choices })).toThrow(/changed during review/)
    expect(S.routines[0].name).toBe('Edited during preview')
  })
  it('validates custom field types before adding an exercise that the editor cannot open', () => {
    const data = createRoutineExchange(fixture()); data.catalog.find(ex => ex.id === 'custom-a').definition.desc = 42
    expect(validateRoutineExchange(data, empty()).errors).toEqual(expect.arrayContaining([expect.objectContaining({ sheet: 'Catálogo', field: 'desc' })]))
  })
  it('returns recoverable concrete errors for null records in malformed JSON', () => {
    const data = createRoutineExchange(fixture()); data.catalog.push(null); data.routines.push(null)
    expect(validateRoutineExchange(data, empty()).errors).toEqual(expect.arrayContaining([expect.objectContaining({ sheet: 'Catálogo' }), expect.objectContaining({ sheet: 'Rutinas' })]))
  })
  it('preserves inactive legacy minimum fields while validating the effective fixed/automatic targets', () => {
    const S = fixture(), e = S.routines[0].ex[0]
    e.repRange = false; e.repsMin = 99; e.topRepsMin = 99; e.backoffRepsMin = 99; e.backoffRepsMax = 1
    const data = createRoutineExchange(S), checked = validateRoutineExchange(data, empty())
    expect(checked.errors).toEqual([]); expect(checked.data.routines[1].ex[0]).toEqual(e)
    const rows = routineExchangeRows(data).Series.filter(row => row[0] === 'r1:1')
    expect(rows.find(row => row[2] === 'Top').slice(3, 5)).toEqual([8, 8]); expect(rows.find(row => row[2] === 'Back-off').slice(3, 5)).toEqual([10, 10])
  })
  it('converts weight units explicitly and leaves timed increments in seconds', () => {
    const data = createRoutineExchange(fixture()), S = { ...empty(), unit: 'lb' }, checked = validateRoutineExchange(data, S)
    expect(() => applyRoutineExchange(S, checked)).toThrow()
    const next = applyRoutineExchange(S, checked, { conflicts: { unit: 'convert' } })
    expect(next.routines[1].ex[0].weight).toBeCloseTo(220.462262, 5)
    expect(next.routines[0].ex[0].inc).toBe(5)
  })
})

describe('editable native XLSX round trip', () => {
  it('has true linked dropdowns, exact original names and separate aliases', async () => {
    const S = fixture(), workbook = await createRoutineWorkbook(createRoutineExchange(S))
    expect(workbook.worksheets.filter(sheet => sheet.state === 'visible').map(sheet => sheet.name)).toEqual(['Instrucciones', 'Rutinas', 'Ejercicios de rutina', 'Series', 'Catálogo'])
    expect(workbook.getWorksheet('Ejercicios de rutina').dataValidations.model['C2:C10001']).toMatchObject({ type: 'list', formulae: ['TGymExercises'] })
    expect(workbook.getWorksheet('Series').dataValidations.model['C2:C10001'].type).toBe('list')
    const selectors = routineExchangeRows(createRoutineExchange(S)).Catálogo.filter(row => row[1] === 'Duplicate original').map(row => row[4]); expect(new Set(selectors).size).toBe(2)
  })
  it('preserves every routine field and custom catalog definition through real serialized XLSX', async () => {
    const S = fixture(), parsed = await roundtrip(S)
    expect(parsed.errors).toEqual([]); expect(parsed.data.routines).toEqual([S.routines[1], S.routines[0]])
    const checked = validateRoutineExchange(parsed.data, empty()); expect(checked.errors).toEqual([])
    const imported = applyRoutineExchange(empty(), checked, { schedule: true, rules: true })
    expect(imported.customEx).toEqual(S.customEx); expect(imported.week).toEqual(S.week); expect(imported.dayPlan).toEqual(S.dayPlan)
  })
  it('imports edited names, notes, order, weekly schedule and shared working targets', async () => {
    const S = fixture(); S.routines = [{ id: 'working', name: 'Before', ex: [{ id: known, sets: 2, reps: 8, weight: 20, note: 'old' }] }]; S.week = { 1: ['working'] }; S.dayPlan = {}; S.routineOrder = ['working']
    const parsed = await roundtrip(S, workbook => { const r = workbook.getWorksheet('Rutinas'); r.getCell('B2').value = 'After'; r.getCell('D2').value = '{"5":0}'; workbook.getWorksheet('Ejercicios de rutina').getCell('F2').value = 'New note'; const series = workbook.getWorksheet('Series'); for (const row of [2, 3]) { series.getCell(`D${row}`).value = 10; series.getCell(`E${row}`).value = 12; series.getCell(`F${row}`).value = 30 } })
    expect(parsed.errors).toEqual([]); expect(parsed.data.routines[0].name).toBe('After'); expect(parsed.data.week).toEqual({ 5: ['working'] })
    expect(parsed.data.routines[0].ex[0]).toMatchObject({ note: 'New note', repsMin: 10, reps: 12, weight: 30, repRange: true })
  })
  it('rejects independently varied rows instead of silently losing unsupported targets', async () => {
    const parsed = await roundtrip(fixture(), workbook => { const sheet = workbook.getWorksheet('Series'); const row = sheet.findRow(3); row.getCell(15).value = 60 })
    expect(parsed.errors.some(error => error.field === 'Tiempo (s)' && /shared/.test(error.message))).toBe(true)
  })
  it('retains unknown spreadsheet names for explicit mapping', async () => {
    const parsed = await roundtrip(fixture(), workbook => { workbook.getWorksheet('Ejercicios de rutina').getCell('C2').value = 'unknown pasted exercise' })
    expect(parsed.errors).toEqual([]); const check = validateRoutineExchange(parsed.data, empty()); expect(check.unresolved[0].name).toBe('unknown pasted exercise')
  })
  it('rejects missing sheets, corrupt version, empty inputs, formulas and wrong file extensions', async () => {
    const parsed = await roundtrip(fixture(), workbook => { workbook.getWorksheet('Instrucciones').getCell('B2').value = 9; workbook.getWorksheet('Rutinas').getCell('B2').value = { formula: '1+1', result: 2 }; workbook.removeWorksheet(workbook.getWorksheet('Series').id) })
    expect(parsed.errors.map(error => error.sheet)).toEqual(expect.arrayContaining(['Instrucciones', 'Rutinas', 'Series']))
    await expect(readRoutineExchangeFile(new File([], 'empty.json'))).rejects.toThrow(/nonempty/)
    await expect(readRoutineExchangeFile(new File(['a'], 'plan.pdf'))).rejects.toThrow(/PDF/)
  })
  it('keeps timed warmup targets automatic and rejects attempts to edit their durations', async () => {
    const S = fixture(); S.routines[1].ex[0].warmupSets = 1
    const workbook = await createRoutineWorkbook(createRoutineExchange(S))
    expect(workbook.getWorksheet('Series').getCell('O2').value).toBe('')
    workbook.getWorksheet('Series').getCell('O2').value = 999
    const parsed = await parseRoutineWorkbook(await workbook.xlsx.writeBuffer())
    expect(parsed.errors.some(error => error.field === 'Warm-up' && /duration/.test(error.message))).toBe(true)
  })
  it('treats clearing an alias as an explicit conflict and does not clear unrelated absent aliases', async () => {
    const S = fixture(), data = createRoutineExchange(S), workbook = await createRoutineWorkbook(data)
    const catalog = workbook.getWorksheet('Catálogo'), row = data.catalog.findIndex(ex => ex.id === known) + 2
    catalog.getCell(`C${row}`).value = ''
    const parsed = await parseRoutineWorkbook(await workbook.xlsx.writeBuffer()), checked = validateRoutineExchange(parsed.data, S)
    expect(checked.conflicts.some(conflict => conflict.key === `alias:${known}`)).toBe(true)
    const next = applyRoutineExchange(S, checked, { conflicts: Object.fromEntries(checked.conflicts.map(conflict => [conflict.key, 'replace'])) })
    expect(next.exerciseAliases[known]).toBe(''); expect(next.exerciseAliases['custom-a']).toBe('My custom alias')
  })
  it('exports a downloadable empty template with current full catalog, without fake user routines', async () => {
    const file = await buildRoutineExchangeFile(fixture(), [], 'xlsx', { template: true })
    expect(file.name).toContain('routine-template-v1'); const parsed = await parseRoutineWorkbook(await file.blob.arrayBuffer()); expect(parsed.errors).toEqual([]); expect(parsed.data.routines).toEqual([]); expect(parsed.data.catalog.length).toBe(CATALOGUE.length + 2)
  })
})

describe('paginated PDF prescription content', () => {
  it('keeps long names/notes, every prescribed row and Top associations across pages', () => {
    const S = fixture(); S.routines[0].ex[0].note = 'Long note '.repeat(1500) + ' FINAL_NOTE_MARKER'
    const pages = routinePDFPages(createRoutineExchange(S)), content = pages.map(page => page.svg).join('')
    expect(pages.length).toBeGreaterThan(2); expect(content).toContain('FINAL_NOTE_MARKER'); expect(content).toContain('Load reduction 10%'); expect(content).toContain('Bench nickname'); expect(content).toContain('Original:'); expect(content).toContain('45 s'); expect(content).toContain('Increment 5 s')
    for (const page of pages) expect(page.svg).not.toMatch(/y="1[1-9]\d\d"/)
  })
  it('includes effective inherited superset move and round rests', () => {
    const S = fixture(); S.restAdvanced.supersetMove = 15; S.routines[0].supersetRoundRestSec = 195
    const content = routinePDFPages(createRoutineExchange(S)).map(page => page.svg).join('')
    expect(content).toContain('Superset move rest: 15 s | Round rest: 195 s')
  })
  it('uses the original name preference for PDF headings and retains aliases separately', () => {
    const S = fixture(); S.exerciseNameMode = 'original'
    const content = routinePDFPages(createRoutineExchange(S)).map(page => page.svg).join('')
    expect(content).toContain(`1. ${CATALOGUE[0].n}`); expect(content).toContain('Alias: Bench nickname')
  })
})
