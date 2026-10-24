import { describe, expect, it } from 'vitest'
import { CATALOGUE } from './exercises.js'
import { applyRoutineExchange, createRoutineExchange, readRoutineExchangeFile, validateRoutineExchange } from './routine-exchange.js'
import { buildSets } from './history.js'

const known = CATALOGUE[0]
const empty = () => ({ unit: 'kg', routines: [], routineOrder: [], customEx: [], exerciseAliases: {}, exNotes: {}, week: {}, dayPlan: {}, workouts: [{ id: 'history', entries: [] }], active: { id: 'active' }, exWeights: {} })
const source = () => ({ ...empty(), step: 2.5, routines: [{ id: 'routine', name: 'Routine áéíóú', ex: [{ id: known.id, sets: 2, reps: 8, weight: 10 }] }], routineOrder: ['routine'] })

describe('JSON import boundary regressions', () => {
  it.each(['NotAllowedError', 'SecurityError', 'NotReadableError', 'QuotaExceededError'])('preserves the original %s when reading a file fails', async name => {
    const error = new DOMException('Cannot read selected file', name)
    await expect(readRoutineExchangeFile({ name: 'routines.json', size: 10, text: async () => { throw error } })).rejects.toBe(error)
  })

  it('classifies malformed JSON without replacing the original parse exception', async () => {
    const file = { name: 'routines.json', size: 10, text: async () => '{ invalid' }
    const error = await readRoutineExchangeFile(file).catch(error => error)
    expect(error).toMatchObject({kind:'validation', stage:'parse'})
    expect(error.cause).toBeInstanceOf(SyntaxError)
    expect(error.cause.stack).toContain('JSON.parse')
  })

  it.each([{ name: 'routines.json', size: 0 }, { name: 'routines.pdf', size: 10 }])('classifies rejected file selection as validation before reading', async file => {
    await expect(readRoutineExchangeFile(file)).rejects.toMatchObject({kind:'validation',stage:'select'})
  })

  it('accepts a JSON BOM without changing its declared source unit', async () => {
    const data = {...createRoutineExchange(source()), unit:'lb'}
    const file = { name: 'routines.json', size: 100, text: async () => `\uFEFF${JSON.stringify(data)}` }
    const read = await readRoutineExchangeFile(file)
    expect(read.data).toEqual(data)
    expect(read.data.unit).toBe('lb')
  })

  it.each([
    ['setRestSec', ['bad']], ['sec', 0], ['unit', 'stone'], ['done', true], ['target', { sets: [{ done: true }] }],
  ])('rejects malformed or performed exercise field %s before any mutation', (field, value) => {
    const data = createRoutineExchange(source()), state = empty(), before = structuredClone(state)
    Object.assign(data.routines[0].ex[0], { [field]: value }, field === 'sec' ? { mode: 'time' } : {})
    const checked = validateRoutineExchange(data, state)
    expect(checked.valid).toBe(false)
    expect(checked.errors.some(error => error.field === field)).toBe(true)
    expect(() => applyRoutineExchange(state, checked)).toThrow()
    expect(state).toEqual(before)
  })

  it('rejects misleading original names for built-in IDs', () => {
    const data = createRoutineExchange(source())
    data.catalog.find(ex => ex.id === known.id).n = 'A different movement'
    const check = validateRoutineExchange(data, empty())
    expect(check.valid).toBe(false)
    expect(check.errors).toEqual(expect.arrayContaining([expect.objectContaining({ sheet: 'Catálogo', field: 'Nombre original' })]))
  })

  it('requires explicit source units for unit-less legacy plans and preserves that review for apply', () => {
    const legacy = { framegym_plan: 1, routines: [{ id: 'old-plan', name: 'Old plan', ex: [{ id: known.id, sets: 2, reps: 8, weight: 100 }] }], week: { 1: 'old-plan' }, customEx: [] }
    const state = empty(), pending = validateRoutineExchange(legacy, state)
    expect(pending.needsLegacyUnit).toBe(true)
    expect(pending.valid).toBe(false)
    expect(pending.routineCount).toBe(1)
    expect(pending.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'Unidad' })]))
    expect(pending.data.unit).toBeUndefined()
    const check = validateRoutineExchange(legacy, state, { legacyUnit: 'lb' })
    expect(check.valid).toBe(true)
    expect(check.needsLegacyUnit).toBe(true)
    expect(check.sourceData).toEqual(legacy)
    expect(() => applyRoutineExchange(state, check)).toThrow(/Choose how/)
    expect(() => applyRoutineExchange(state, check, { conflicts: { unit: 'convert' } })).toThrow(/explicitly accept/)
    const next = applyRoutineExchange(state, check, { conflicts: { unit: 'convert' }, acceptAdaptations: true })
    expect(next.routines[0].ex[0].weight).toBeCloseTo(45.359237)
    expect(next.week).toEqual(state.week)
  })

  it('does not accept an untrusted convertedLegacy marker as permission to omit current prescriptions', () => {
    const data = createRoutineExchange(source())
    data.convertedLegacy = true
    delete data.routines[0].ex[0].reps
    const check = validateRoutineExchange(data, empty())
    expect(check.valid).toBe(false)
    expect(check.data.convertedLegacy).toBeUndefined()
    expect(check.errors.some(error => error.field === 'reps')).toBe(true)
  })

  it.each(['sets', 'reps'])('reports the missing current prescription %s without filling a zero', field => {
    const data = createRoutineExchange(source())
    delete data.routines[0].ex[0][field]
    const check = validateRoutineExchange(data, empty())
    expect(check.valid).toBe(false)
    expect(check.errors.some(error => error.field === field)).toBe(true)
    expect(check.data.routines[0].ex[0][field]).toBeUndefined()
  })

  it.each(['__proto__', 'constructor', 'prototype'])('rejects unsafe identity values %s before object-key writes', id => {
    const state = empty(), data = createRoutineExchange(source())
    data.catalog.push({ id, n: 'Unsafe custom', custom: true, alias: 'Unsafe alias' })
    data.routines[0].ex[0].id = id
    const before = structuredClone(state), check = validateRoutineExchange(data, state)
    expect(check.valid).toBe(false)
    expect(() => applyRoutineExchange(state, check)).toThrow()
    expect(state).toEqual(before)
    expect(Object.prototype.alias).toBeUndefined()
  })

  it('preserves formula-like names and notes as literal text', () => {
    const S = source()
    S.routines[0].name = '=SUM(1,2)'
    S.routines[0].note = '+cmd|no execution'
    S.routines[0].ex[0].note = '@literal prescription áéíóú'
    const data = JSON.parse(JSON.stringify(createRoutineExchange(S))), state = empty()
    const next = applyRoutineExchange(state, validateRoutineExchange(data, state))
    expect(next.routines).toEqual(data.routines)
    expect(next.routines[0].name).toBe(S.routines[0].name)
    expect(next.routines[0].note).toBe(S.routines[0].note)
    expect(next.routines[0].ex[0].note).toBe(S.routines[0].ex[0].note)
    expect(next.workouts).toEqual(state.workouts)
  })

  it('imports only custom definitions and aliases needed by accepted routines', () => {
    const S = source()
    S.customEx = [{ id: 'unrelated', n: 'Unrelated custom', custom: true }]
    S.exerciseAliases = { [known.id]: 'Press nickname', unrelated: 'Unrelated nickname' }
    S.exNotes = { unrelated: 'A private unrelated note' }
    const state = empty(), data = createRoutineExchange(S), checked = validateRoutineExchange(data, state)
    const next = applyRoutineExchange(state, checked)
    expect(next.customEx).toEqual([])
    expect(next.exerciseAliases).toEqual({ [known.id]: 'Press nickname' })
    expect(next.exNotes).toEqual({})
  })

  it('keeping every existing routine leaves its catalogue metadata unchanged', () => {
    const state = source(), data = createRoutineExchange(state)
    data.catalog.find(ex => ex.id === known.id).alias = 'Replacement nickname'
    data.catalog.find(ex => ex.id === known.id).aliasPresent = true
    const checked = validateRoutineExchange(data, state)
    const choices = Object.fromEntries(checked.conflicts.map(c => [c.key, c.kind === 'routine' ? 'keep' : 'replace']))
    expect(applyRoutineExchange(state, checked, { conflicts: choices })).toEqual(state)
  })

  it('retains explicit unknown-ID mappings across validation and atomic apply', () => {
    const data = createRoutineExchange(source()), state = empty()
    data.routines[0].ex[0].id = 'missing'
    data.catalog.push({ id: 'missing', n: 'Unknown exercise', alias: 'Do not add to unknown ID', aliasPresent: true })
    const checked = validateRoutineExchange(data, state, { exerciseMappings: { missing: known.id } })
    expect(checked.valid).toBe(true)
    const next = applyRoutineExchange(state, checked)
    expect(next.routines[0].ex[0].id).toBe(known.id)
    expect(next.exerciseAliases.missing).toBeUndefined()
    expect(next.workouts).toEqual(state.workouts)
    expect(next.active).toEqual(state.active)
    expect(buildSets(next, next.routines[0].ex[0]).every(row => row.done === false)).toBe(true)
  })

  it('does not import unrelated full-catalog metadata for the target of an explicit exercise mapping', () => {
    const data = createRoutineExchange(source()), state = empty()
    data.routines[0].ex[0].id = 'missing'
    data.catalog.push({ id: 'missing', n: 'Unknown exercise' })
    Object.assign(data.catalog.find(ex => ex.id === known.id), { alias: 'Unrelated source nickname', aliasPresent: true, libraryNote: 'Unrelated source note' })
    state.exerciseAliases[known.id] = 'Keep my current nickname'
    state.exNotes[known.id] = 'Keep my current library note'
    const checked = validateRoutineExchange(data, state, { exerciseMappings: { missing: known.id } })
    expect(checked.valid).toBe(true)
    expect(checked.conflicts).toEqual([])
    const next = applyRoutineExchange(state, checked)
    expect(next.routines[0].ex[0].id).toBe(known.id)
    expect(next.exerciseAliases).toEqual(state.exerciseAliases)
    expect(next.exNotes).toEqual(state.exNotes)
  })

  it('reviews source deload differences without replacing destination globals and converts only the imported loading step', () => {
    const S = source()
    S.deload = { on: true, notifications: false, normalWeeks: 6, deloadWeeks: 1, loadPct: 80, setPct: 60, targetRir: 4, startDate: '2026-10-10' }
    const data = createRoutineExchange(S), state = { ...empty(), unit: 'lb', step: 5 }, checked = validateRoutineExchange(data, state)
    expect(checked.errors).toEqual([])
    expect(checked.adaptations).toEqual(expect.arrayContaining([expect.objectContaining({key:'deload',source:S.deload})]))
    expect(() => applyRoutineExchange(state, checked, {conflicts:{unit:'convert'},rules:true})).toThrow(/explicitly accept/)
    const next = applyRoutineExchange(state, checked, {conflicts:{unit:'convert'},acceptAdaptations:true,rules:true})
    expect(next.deload).toBeUndefined(); expect(next.step).toBe(5)
    expect(next.routines[0].ex[0].loadingStep).toBeCloseTo(data.routines[0].ex[0].loadingStep * 2.2046226218)
    expect(state.deload).toBeUndefined(); expect(state.routines).toEqual([])
  })

  it('does not invent a missing start date for an enabled deload cycle', () => {
    const data = createRoutineExchange(source())
    data.rules.deload = { on: true, normalWeeks: 6, deloadWeeks: 1, startDate: null }
    const check = validateRoutineExchange(data, empty())
    expect(check.valid).toBe(false)
    expect(check.errors.some(error => error.field === 'deload.startDate')).toBe(true)
    expect(check.data.rules.deload.startDate).toBeNull()
  })

  it('compares custom definitions by content rather than JSON property insertion order', () => {
    const state = source()
    state.customEx = [{ id: 'custom', n: 'Custom á', bp: 'back', eq: 'cable', custom: true }]
    state.routines[0].ex[0].id = 'custom'
    const data = createRoutineExchange(state), custom = data.catalog.find(ex => ex.id === 'custom')
    custom.definition = { custom: true, eq: 'cable', n: 'Custom á', id: 'custom', bp: 'back' }
    const check = validateRoutineExchange(data, state)
    expect(check.errors).toEqual([])
    expect(check.conflicts.some(conflict => conflict.kind === 'catalog')).toBe(false)
  })

  it('detects duplicate copies and requires a reviewed conflict choice on JSON reimport', () => {
    const state = empty(), data = createRoutineExchange(source()), first = applyRoutineExchange(state, validateRoutineExchange(data, state))
    const reexported = JSON.parse(JSON.stringify(createRoutineExchange(first))), checked = validateRoutineExchange(reexported, first)
    expect(checked.conflicts.some(c => c.key === 'routine:routine')).toBe(true)
    expect(() => applyRoutineExchange(first, checked)).toThrow()
    const again = applyRoutineExchange(first, checked, { conflicts: { 'routine:routine': 'replace' } })
    expect(again.routines).toEqual(first.routines)
    expect(again.workouts).toEqual(state.workouts)
    expect(again.active).toEqual(state.active)
  })

  it('preserves complete repeated-exercise relationships and inherited/exception rules through JSON reexport', () => {
    const S = source(), state = empty()
    S.backoffRepsMode = 'same'; S.strictReps = true; S.effort = 'rir'; S.restSec = 90
    S.restAdvanced = { warmup: 30, supersetMove: 0, supersetRound: 120 }
    S.customEx = [{ id: 'custom-1', n: 'Duplicate original', custom: true }, { id: 'custom-2', n: 'Duplicate original', custom: true }]
    S.exerciseAliases = { 'custom-1': 'Apodo largo ñ', 'custom-2': 'Otro apodo' }
    S.routines[0].ex = [
      { id: known.id, sets: 3, reps: 8, repsMin: 6, repRange: true, weight: 40, warmupSets: 2, sg: 'group', setScheme: 'topback', topSets: 1, backoffSets: 2, topRepsMin: 6, topRepsMax: 8, backoffPct: 15, autoBackoffReps: true, backoffRepsMode: 'same', targetRir: 2, topRirMin: 1, topRirMax: 2, backoffRirMin: 2, backoffRirMax: 3 },
      { id: 'custom-1', sets: 2, reps: 10, repsMin: 8, weight: 0, bodyweight: true, side: true, repsPerSide: true, sg: 'group', intensifier: { type: 'restpause', totalReps: 20, restSec: 15 } },
      { id: known.id, sets: 4, reps: 12, weight: 60, setScheme: 'topback', topSets: 2, backoffSets: 2, backoffRepOffset: 4, autoBackoffReps: false, backoffRepsMin: 13, backoffRepsMax: 15, setRestSec: [60, 60, 90, 90], intensifier: { type: 'dropset', count: 2, pct: 20 } },
      { id: 'custom-2', mode: 'time', sets: 2, sec: 45, weight: 0, side: true, warmupSets: 1, inc: 5, prog: 'time' },
      { id: 'custom-2', mode: 'cardio', sets: 1, min: 20, speed: 6.5, restSec: 0, prog: 'off' },
    ]
    S.routines.push({ id: 'routine-2', name: 'Second', ex: [{ id: known.id, sets: 2, reps: 8, weight: 20, setScheme: 'topback', topSets: 1, backoffSets: 1, autoBackoffReps: true, backoffRepsMode: 'increased' }] })
    S.routineOrder = ['routine-2', 'routine']; S.week = { 1: ['routine', 'routine-2'] }; S.dayPlan = { '2026-10-10': ['routine-2', 'routine'] }
    const data = JSON.parse(JSON.stringify(createRoutineExchange(S))), checked = validateRoutineExchange(data, state)
    expect(checked.errors).toEqual([])
    const first = applyRoutineExchange(state, checked, {schedule:true,acceptAdaptations:true})
    const reexported = JSON.parse(JSON.stringify(createRoutineExchange(first)))
    expect(reexported.routines).toEqual(data.routines)
    expect(reexported.week).toEqual(data.week); expect(reexported.dayPlan).toEqual(data.dayPlan)
    expect(first.backoffRepsMode).toBeUndefined(); expect(first.strictReps).toBeUndefined(); expect(first.effort).toBeUndefined()
    expect(reexported.rules.effort).toBe('none')
    expect(reexported.routines[1].ex[0]).toMatchObject({backoffRepsMode:'same',backoffRepsOverride:true,strictReps:true,restSec:90})
    expect(reexported.catalog.filter(ex => ex.custom)).toEqual(data.catalog.filter(ex => ex.custom))
    const rechecked = validateRoutineExchange(reexported, first), choices = Object.fromEntries(rechecked.conflicts.map(c => [c.key, 'replace']))
    const second = applyRoutineExchange(first, rechecked, {conflicts:choices,schedule:true})
    expect(second).toEqual(first)
  })
})
