import { CATALOGUE } from './exercises.js'
import { orderedRoutines } from './routine-order.js'
import { routineIds } from './daily-plan.js'
import { modeOf, effortOf, MAX_PLANNED_WARMUPS } from './history.js'
import { repBounds, targetRirRangeFor, backoffWeightFor, backoffRepOffsetFor, withBackoffRepsMode } from './training-plan.js'
import { restSeconds } from './rest-policy.js'
import { todayISO } from './format.js'
import { materializeRoutinePrescription, portableExchangeCatalogue, portableRoutineRules, customTransferIssues } from './routine-portability.js'
import { loadingStepFor } from './progression.js'

export const ROUTINE_EXCHANGE_VERSION = 2
const clone = value => JSON.parse(JSON.stringify(value))
const obj = value => value && typeof value === 'object' && !Array.isArray(value)
const canonical = value => Array.isArray(value) ? value.map(canonical) : obj(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
const days = [0, 1, 2, 3, 4, 5, 6]
const builtins = new Map(CATALOGUE.map(ex => [ex.id, ex]))
const badKeys = new Set(['__proto__', 'prototype', 'constructor'])
const PROGS = ['off', 'linear', 'greyskull', 'double', 'time']
const rulesKeys = ['backoffRepsMode', 'strictReps', 'effort', 'restSec', 'restAdvanced', 'warmup', 'step', 'deload']
const validId = value => typeof value === 'string' && !!value.trim() && !badKeys.has(value)
const ownValue = (value, key) => obj(value) && Object.hasOwn(value, key) ? value[key] : undefined
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
const performedFields = ['done', 'doneAt', 'doneLeft', 'doneRight', 'entries', 'target', 'plan', 'drops', 'clusters', 'finished', 'start', 'end', 'resumeSnapshot']
function identityReservations(S) {
  const exercises = new Set(builtins.keys()), routines = new Set()
  const add = (set, id) => { if (validId(id)) set.add(id) }
  for (const ex of S.customEx || []) add(exercises, ex.id)
  for (const r of S.routines || []) { add(routines, r.id); for (const ex of r.ex || []) add(exercises, ex.id) }
  for (const id of S.routineOrder || []) add(routines, id)
  for (const key of ['week', 'dayPlan', 'daySkipped']) for (const value of Object.values(S[key] || {})) for (const id of routineIds(value)) add(routines, id)
  for (const key of ['exWeights', 'exerciseAliases', 'exNotes', 'exerciseGoals']) for (const id of Object.keys(S[key] || {})) add(exercises, id)
  for (const id of Array.isArray(S.avoidedExercises) ? S.avoidedExercises : Object.keys(S.avoidedExercises || {})) add(exercises, id)
  const sessions = [...(S.workouts || []), ...(S.active ? [S.active] : [])], seen = new Set()
  for (const row of sessions) {
    if (!row || seen.has(row)) continue
    seen.add(row)
    add(routines, row.routineId); add(routines, row.sessionOrigin?.routineId)
    for (const entry of row.entries || []) { add(exercises, entry.id); add(exercises, entry.target?.id); add(exercises, entry.exercise?.id); add(exercises, entry.savedExercise?.id); add(exercises, typeof entry.substitutedFor === 'string' ? entry.substitutedFor : entry.substitutedFor?.id) }
    if (row.resumeSnapshot) sessions.push(row.resumeSnapshot)
  }
  return { exercises: [...exercises].sort(), routines: [...routines].sort() }
}
export const routineExchangeReviewKey = S => JSON.stringify({ unit: S.unit, routines: S.routines, routineOrder: S.routineOrder, customEx: S.customEx, exerciseAliases: S.exerciseAliases, exNotes: S.exNotes, week: S.week, dayPlan: S.dayPlan, daySkipped: S.daySkipped, rules: rulesKeys.map(key => S[key]), reservations: identityReservations(S) })
function customDefinition(ex) {
  const { alias, aliasPresent, selector, definition, libraryNote, ...fields } = ex
  return clone(definition || fields)
}
function definitionIdentity(ex) {
  const { id, custom, ...definition } = customDefinition(ex)
  return definition
}
function freshTransferId(prefix, value, reserved) {
  const text = JSON.stringify(canonical(value))
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619)
  const base = `${prefix}-${(hash >>> 0).toString(36)}`
  let id = base, index = 2
  while (reserved.has(id)) id = `${base}-${index++}`
  reserved.add(id)
  return id
}
function convertedRoutine(routine, sourceUnit, targetUnit) {
  const result = clone(routine), factor = sourceUnit === targetUnit ? 1 : sourceUnit === 'kg' ? 2.2046226218 : 1 / 2.2046226218
  for (const ex of result.ex) {
    if (factor !== 1) for (const key of modeOf(ex) === 'time' ? ['weight', 'loadingStep'] : ['weight', 'inc', 'loadingStep']) if (ex[key] != null) ex[key] = Math.round(ex[key] * factor * 1000000) / 1000000
    if (ex.unit != null) ex.unit = targetUnit
  }
  return result
}
function routineIdentity(S, routine) {
  const { id, name, ...content } = materializeRoutinePrescription(S, routine)
  const groups = new Map()
  for (const ex of content.ex) if (ex.sg) { if (!groups.has(ex.sg)) groups.set(ex.sg, `group-${groups.size + 1}`); ex.sg = groups.get(ex.sg) }
  return JSON.stringify(canonical(content))
}
export function exchangeCatalogue(S) {
  const map = new Map(CATALOGUE.map(ex => [ex.id, { id: ex.id, n: ex.n, custom: false }]))
  for (const ex of S.customEx || []) map.set(ex.id, { ...clone(ex), custom: true, definition: clone(ex) })
  return [...map.values()].map(ex => ({ ...ex, alias: ownValue(S.exerciseAliases, ex.id) || '', aliasPresent: Object.hasOwn(S.exerciseAliases || {}, ex.id), ...(ownValue(S.exNotes, ex.id) != null ? { libraryNote: ownValue(S.exNotes, ex.id) } : {}), selector: `${ex.n} [${ex.id}]` }))
}
export function createRoutineExchange(S, ids = (S.routines || []).map(r => r.id), {fullCatalog = false} = {}) {
  const selected = new Set(ids)
  const routines = orderedRoutines(S).filter(r => selected.has(r.id)).map(routine => materializeRoutinePrescription(S, routine))
  const used = new Set(routines.flatMap(routine => routine.ex.map(ex => ex.id)))
  const schedule = field => Object.fromEntries(Object.entries(S[field] || {}).map(([key, value]) => [key, routineIds(value).filter(id => selected.has(id))]).filter(([, value]) => value.length || selected.size === (S.routines || []).length))
  return { tgym_routine_exchange: ROUTINE_EXCHANGE_VERSION, exported: todayISO(), unit: S.unit || 'kg', exerciseNameMode: S.exerciseNameMode === 'original' ? 'original' : 'aliases', routines,
    routineOrder: routines.map(r => r.id), week: schedule('week'), dayPlan: schedule('dayPlan'),
    catalog: portableExchangeCatalogue(S, used, {fullCatalog}), rules: portableRoutineRules(S) }
}
function issue(sheet, row, field, message) { return { sheet, row, field, message } }
function walkSafe(value, errors, path = 'JSON', depth = 0) {
  if (depth > 30) { errors.push(issue(path, 0, '', 'Nesting exceeds 30 levels')); return }
  if (typeof value === 'number' && !Number.isFinite(value)) { errors.push(issue(path, 0, '', 'Numbers must be finite')); return }
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    if (badKeys.has(key)) errors.push(issue(path, 0, key, 'Unsafe object key'))
    else walkSafe(child, errors, `${path}.${key}`, depth + 1)
  }
}
function convertedLegacy(data, legacyUnit) {
  if (data?.framegym_plan === 1 || data?.opengym_plan === 1) return { tgym_routine_exchange: 1, unit: data.unit ?? legacyUnit, routines: data.routines,
    routineOrder: (Array.isArray(data.routines) ? data.routines : []).map(r => r?.id), week: data.week || {}, dayPlan: {}, catalog: [...CATALOGUE.map(ex => ({ id: ex.id, n: ex.n })), ...(data.customEx || []).map(ex => ({ ...ex, custom: true }))], rules: {}, convertedLegacy: true }
  return data
}
export function validateRoutineExchange(raw, S = {}, { exerciseMappings = {}, legacyUnit, conflicts: choices = {}, locations } = {}) {
  const errors = [], unresolved = [], conflicts = [], adaptations = []
  let data, parsed
  try {
    if (typeof raw === 'string' && new TextEncoder().encode(raw).length > ROUTINE_EXCHANGE_MAX_BYTES) return {errors:[issue('JSON',0,'Archivo','Routine exchange exceeds 15 MiB. Export fewer selected routines or reduce embedded media.')],unresolved,conflicts,valid:false}
    parsed = typeof raw === 'string' ? JSON.parse(raw) : structuredClone(raw)
    if (new TextEncoder().encode(JSON.stringify(parsed)).length > ROUTINE_EXCHANGE_MAX_BYTES) errors.push(issue('JSON',0,'Archivo','Routine exchange exceeds 15 MiB. Export fewer selected routines or reduce embedded media.'))
    data = convertedLegacy(parsed, legacyUnit)
    if (data === parsed && obj(data)) delete data.convertedLegacy
  } catch { return { errors: [issue('JSON', 0, '', 'Invalid JSON')], unresolved, conflicts, valid: false } }
  const needsLegacyUnit = !!data?.convertedLegacy && parsed?.unit == null
  walkSafe(parsed, errors)
  if (!obj(data) || ![1, 2].includes(data.tgym_routine_exchange)) errors.push(issue('Instrucciones', 2, 'Versión', 'Unsupported format version. Use TGym routine exchange version 1 or 2, or a legacy version 1 plan.'))
  if (!['kg', 'lb'].includes(data?.unit) && !needsLegacyUnit) errors.push(issue('Instrucciones', 3, 'Unidad', 'Unit must be kg or lb'))
  if (data?.exerciseNameMode != null && !['original', 'aliases'].includes(data.exerciseNameMode)) errors.push(issue('Instrucciones', 4, 'exerciseNameMode', 'Use original or aliases'))
  for (const key of ['workouts', 'active']) if (data && Object.hasOwn(data, key)) errors.push(issue('JSON', 0, key, 'Workout results are not routine prescriptions. Use the full backup import for workout history.'))
  if (!Array.isArray(data?.routines) || !data.routines.length || data.routines.length > 500) errors.push(issue('Rutinas', 2, 'ID', 'Include between 1 and 500 routines'))
  if (!Array.isArray(data?.catalog)) errors.push(issue('Catálogo', 2, 'ID', 'Missing catalog'))
  if (errors.length) return { errors, unresolved, conflicts, valid: false, data, needsLegacyUnit }
  const sourceData = clone(parsed)
  const incoming = new Map(), current = new Map(exchangeCatalogue(S).map(ex => [ex.id, ex])), ids = new Set(), used = new Map()
  data.catalog.forEach((ex, i) => {
    const row = locations?.catalog?.get(ex?.id) ?? i + 2
    if (!obj(ex) || !validId(ex.id) || typeof ex.n !== 'string' || !ex.n.trim()) errors.push(issue('Catálogo', i + 2, 'ID / Nombre original', 'Catalog ID and original name are required; use a nonempty safe ID'))
    else if (incoming.has(ex.id)) errors.push(issue('Catálogo', i + 2, 'ID', 'Duplicate catalog ID'))
    else incoming.set(ex.id, ex)
    if (ex?.custom && builtins.has(ex.id)) errors.push(issue('Catálogo', i + 2, 'ID', 'Custom exercise cannot replace a built-in ID'))
    if (builtins.has(ex?.id) && ex.n !== builtins.get(ex.id).n) errors.push(issue('Catálogo', i + 2, 'Nombre original', `Restore the exact original name for ${ex.id}: ${builtins.get(ex.id).n}. Put a display nickname in Apodo.`))
    if (ex?.alias != null && typeof ex.alias !== 'string') errors.push(issue('Catálogo', i + 2, 'Apodo', 'Alias must be text'))
    if (ex?.aliasPresent != null && typeof ex.aliasPresent !== 'boolean') errors.push(issue('Catálogo', i + 2, 'Apodo', 'Alias presence flag must be boolean'))
    if (ex?.aliasPresent === true && typeof ex.alias !== 'string') errors.push(issue('Catálogo', i + 2, 'Apodo', 'An explicit alias requires text; use an empty string to clear it.'))
    if (ex?.libraryNote != null && typeof ex.libraryNote !== 'string') errors.push(issue('Catálogo', i + 2, 'Notas de biblioteca', 'Library note must be text'))
    if (ex?.custom != null && typeof ex.custom !== 'boolean') errors.push(issue('Catálogo', i + 2, 'Personalizado', 'Custom flag must be boolean'))
    if (ex?.definition != null && (!obj(ex.definition) || ex.definition.id !== ex.id || ex.definition.n !== ex.n)) errors.push(issue('Catálogo', i + 2, 'Definición', 'Custom definition must refer to the same ID and exact original name'))
    if (ex?.custom) {
      const definition = ex.definition || ex
      for (const key of ['id', 'n', 'bp', 'eq', 'tg', 'desc', 'img', 'gif']) if (definition[key] != null && typeof definition[key] !== 'string') errors.push(issue('Catálogo', i + 2, key, 'Custom exercise field must be text'))
      for (const key of ['st', 'primaries', 'secondaries', 'muscleGroups']) if (definition[key] != null && (!Array.isArray(definition[key]) || definition[key].some(value => typeof value !== 'string'))) errors.push(issue('Catálogo', i + 2, key, 'Custom exercise field must be a text array'))
      if (definition.sm != null && !(typeof definition.sm === 'string' || Array.isArray(definition.sm) && definition.sm.every(value => typeof value === 'string'))) errors.push(issue('Catálogo', i + 2, 'sm', 'Use a text array or legacy muscle text'))
      if (definition.activityType != null && typeof definition.activityType !== 'string') errors.push(issue('Catálogo', i + 2, 'activityType', 'Activity type must be text'))
    }
  })
  const number = (value, min, max, sheet, row, field, integer = false) => {
    if (value == null) return
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || integer && !Number.isInteger(value)) errors.push(issue(sheet, row, field, `Expected ${integer ? 'integer' : 'number'} between ${min} and ${max}`))
  }
  let exerciseRow = 1
  data.routines.forEach((r, ri) => {
    const row = locations?.routines?.get(r?.id) ?? ri + 2
    if (!obj(r) || !validId(r.id) || typeof r.name !== 'string' || !r.name.trim() || !Array.isArray(r.ex)) { errors.push(issue('Rutinas', row, 'ID / Nombre', 'Routine ID, name and exercise array are required; use a nonempty safe ID')); return }
    if (ids.has(r.id)) errors.push(issue('Rutinas', row, 'ID', 'Duplicate routine ID'))
    ids.add(r.id)
    if (r.prog != null && !PROGS.includes(r.prog)) errors.push(issue('Rutinas', row, 'prog', 'Unknown progression rule'))
    if (r.note != null && typeof r.note !== 'string') errors.push(issue('Rutinas', row, 'Notas', 'Notes must be text'))
    if (r.emoji != null && typeof r.emoji !== 'string') errors.push(issue('Rutinas', row, 'emoji', 'Routine icon must be text'))
    for (const key of performedFields) if (Object.hasOwn(r, key)) errors.push(issue('Rutinas', row, key, 'Remove performed workout results; this file accepts routine prescriptions only'))
    for (const key of ['restSec', 'betweenRestSec', 'warmupRestSec', 'supersetMoveRestSec', 'supersetRoundRestSec']) number(r[key], 0, 86400, 'Rutinas', row, key, true)
    if (r.ex.length > 1000) errors.push(issue('Ejercicios de rutina', row, 'Orden', 'Maximum 1000 exercises per routine'))
    const groups = new Map()
    r.ex.forEach((e, ei) => {
      const ordinal = ++exerciseRow
      const sourceKey = `${r.id}:${ei + 1}`
      const erow = locations?.exercises?.get(sourceKey) ?? ordinal
      const errorStart = errors.length
      if (!obj(e) || !validId(e.id)) { errors.push(issue('Ejercicios de rutina', erow, 'Ejercicio', 'A nonempty safe exercise ID is required')); return }
      const sourceDefinition = incoming.get(e.id)?.definition || incoming.get(e.id) || builtins.get(e.id)
      const exerciseMode = ['reps','time','cardio'].includes(e.mode) ? e.mode : sourceDefinition?.bp === 'cardio' ? 'cardio' : 'reps'
      if (!used.has(e.id)) used.set(e.id, erow)
      if (e.note != null && typeof e.note !== 'string') errors.push(issue('Ejercicios de rutina', erow, 'Notas', 'Notes must be text'))
      if (e.sg != null && typeof e.sg !== 'string') errors.push(issue('Ejercicios de rutina', erow, 'Superset', 'Superset identifier must be text'))
      for (const key of performedFields) if (Object.hasOwn(e, key)) errors.push(issue('Ejercicios de rutina', erow, key, 'Remove performed workout results; this file accepts routine prescriptions only'))
      number(e.sets, 1, 99, 'Ejercicios de rutina', erow, 'sets', true)
      if (!data.convertedLegacy) {
        if (e.sets == null) errors.push(issue('Series', erow, 'sets', 'Add the prescribed number of sets; an absent value does not mean zero'))
        const prescription = exerciseMode === 'time' ? 'sec' : exerciseMode === 'cardio' ? 'min' : e.setScheme === 'topback' && e.topRepsMax != null ? 'topRepsMax' : 'reps'
        if (e[prescription] == null) errors.push(issue('Series', erow, prescription, 'Add the exercise prescription; missing values are not performed results or zero'))
      }
      number(e.warmupSets, 0, MAX_PLANNED_WARMUPS, 'Series', erow, 'Warm-up', true)
      for (const key of ['reps', 'repsMin', 'repsMax', 'topRepsMin', 'topRepsMax', 'backoffRepsMin', 'backoffRepsMax']) number(e[key], 1, 100000, 'Series', erow, key, true)
      for (const key of ['topSets', 'backoffSets']) number(e[key], 1, 99, 'Series', erow, key, true)
      for (const key of ['weight', 'inc', 'sec', 'min', 'speed']) number(e[key], 0, 1000000, 'Series', erow, key)
      number(e.loadingStep, 0.000001, 1000000, 'Series', erow, 'loadingStep')
      if (e.activityType != null && typeof e.activityType !== 'string') errors.push(issue('Ejercicios de rutina', erow, 'activityType', 'Activity type must be text'))
      if (exerciseMode === 'time' && e.sec === 0) errors.push(issue('Series', erow, 'sec', 'Timed duration must be greater than zero seconds'))
      if (exerciseMode === 'cardio' && e.min === 0) errors.push(issue('Series', erow, 'min', 'Cardio duration must be greater than zero minutes'))
      if (e.unit != null && (!['kg', 'lb'].includes(e.unit) || e.unit !== data.unit)) errors.push(issue('Series', erow, 'unit', 'Exercise load unit must match the file unit kg or lb'))
      for (const key of ['targetRir', 'targetRirMin', 'targetRirMax', 'topRir', 'topRirMin', 'topRirMax', 'backoffRir', 'backoffRirMin', 'backoffRirMax']) number(e[key], 0, 10, 'Series', erow, key)
      for (const [lo, hi] of [['repsMin', 'reps'], ['topRepsMin', 'topRepsMax'], ['backoffRepsMin', 'backoffRepsMax'], ['targetRirMin', 'targetRirMax'], ['topRirMin', 'topRirMax'], ['backoffRirMin', 'backoffRirMax']]) {
        const ignoredLegacyBounds = e.repRange === false && ['repsMin', 'topRepsMin'].includes(lo) || lo === 'backoffRepsMin' && e.setScheme === 'topback' && e.autoBackoffReps !== false
        if (e[lo] != null && e[hi] != null && e[lo] > e[hi] && !ignoredLegacyBounds) errors.push(issue('Series', erow, `${lo} / ${hi}`, 'Minimum exceeds maximum'))
      }
      for (const key of ['side', 'repsPerSide', 'bodyweight', 'repRange', 'strictReps', 'autoBackoffReps', 'backoffRepsOverride', 'amrap']) if (e[key] != null && typeof e[key] !== 'boolean') errors.push(issue('Ejercicios de rutina', erow, key, 'Expected boolean'))
      for (const key of ['restSec', 'afterRestSec', 'warmupRestSec', 'supersetMoveRestSec', 'supersetRoundRestSec']) number(e[key], 0, 86400, 'Series', erow, key, true)
      if (e.setRestSec != null) {
        if (!Array.isArray(e.setRestSec) || e.setRestSec.length > 99) errors.push(issue('Series', erow, 'setRestSec', 'Use an array of at most 99 rest values in seconds'))
        else for (const value of e.setRestSec) number(value, 0, 86400, 'Series', erow, 'setRestSec', true)
      }
      if (e.mode != null && !['reps', 'time', 'cardio'].includes(e.mode)) errors.push(issue('Series', erow, 'Modo', 'Unknown exercise mode'))
      if (e.setScheme != null && !['straight', 'topback'].includes(e.setScheme)) errors.push(issue('Series', erow, 'Tipo', 'Unknown set scheme'))
      if (e.backoffRepsMode != null && !['same', 'increased'].includes(e.backoffRepsMode)) errors.push(issue('Series', erow, 'Regla Back-off', 'Use same or increased'))
      number(e.backoffPct, 1, 50, 'Series', erow, 'Reducción %')
      number(e.backoffRepOffset, 0, 10, 'Series', erow, 'backoffRepOffset')
      if (e.setScheme === 'topback' && e.autoBackoffReps !== false && e.backoffRepsOverride === true && !['same', 'increased'].includes(e.backoffRepsMode) && !(typeof e.backoffRepOffset === 'number' && e.backoffRepOffset > 0)) errors.push(issue('Series', erow, 'backoffRepsOverride', 'An explicit automatic Back-off rule requires same, increased or a positive legacy backoffRepOffset. Omit backoffRepsOverride to follow the app setting.'))
      if (e.setScheme === 'topback' && exerciseMode !== 'reps') errors.push(issue('Series', erow, 'Tipo', 'Top / Back-off requires repetition mode'))
      if (e.prog != null && !PROGS.includes(e.prog)) errors.push(issue('Ejercicios de rutina', erow, 'prog', 'Unknown progression rule'))
      if (e.intensifier != null) {
        const x = e.intensifier
        if (!obj(x) || !['dropset', 'restpause'].includes(x.type)) errors.push(issue('Ejercicios de rutina', erow, 'intensifier', 'Unknown intensity technique'))
        else if (x.type === 'dropset') { number(x.count, 1, 99, 'Series', erow, 'Drop count', true); number(x.pct, 5, 100, 'Series', erow, 'Drop %') }
        else { number(x.totalReps, 1, 100000, 'Series', erow, 'Rest-pause reps', true); number(x.restSec, 5, 86400, 'Series', erow, 'Rest-pause seconds', true) }
      }
      // Workbook parsing retains physical row provenance outside the portable payload.
      // Core checks also validate advanced JSON fields, which live on the exercise row.
      if (locations) for (const error of errors.slice(errorStart)) {
        if (error.sheet !== 'Series') continue
        const source = locations.fields?.get(`${sourceKey}:${error.field}`)
        Object.assign(error, source || { sheet: 'Ejercicios de rutina', row: erow, field: `Configuración (JSON): ${error.field}` })
      }
      if (e.sg) { const positions = groups.get(e.sg) || []; positions.push(ei); groups.set(e.sg, positions) }
    })
    for (const positions of groups.values()) if (positions.length < 2 || positions.at(-1) - positions[0] + 1 !== positions.length) errors.push(issue('Ejercicios de rutina', locations?.exercises?.get(`${r.id}:${positions[0] + 1}`) ?? row, 'Superset', 'Superset requires at least two consecutive exercises'))
  })
  if (!Array.isArray(data.routineOrder) || data.routineOrder.length !== ids.size || new Set(data.routineOrder).size !== ids.size || data.routineOrder.some(id => typeof id !== 'string' || !ids.has(id))) errors.push(issue('Rutinas', 2, 'Orden', 'Routine order must list every routine ID exactly once'))
  for (const field of ['week', 'dayPlan']) {
    if (!obj(data[field])) { errors.push(issue('Rutinas', 2, field, 'Schedule must be an object')); continue }
    for (const [key, value] of Object.entries(data[field])) {
      if (!(typeof value === 'string' || Array.isArray(value) && value.every(id => typeof id === 'string' && id))) { errors.push(issue('Rutinas', 2, field, `Schedule must contain routine-ID arrays or legacy strings: ${key}`)); continue }
      if (field === 'week' ? !days.some(day => String(day) === key) : !validDate(key)) errors.push(issue('Rutinas', 2, field, `Invalid schedule key: ${key}`))
      const values = Array.isArray(value) ? value : routineIds(value)
      if (values.some(id => !ids.has(id)) || new Set(values).size !== values.length) errors.push(issue('Rutinas', 2, field, `Unknown or duplicate routine reference: ${key}`))
    }
  }
  if (!obj(data.rules)) errors.push(issue('Instrucciones', 4, 'Reglas', 'Rules must be an object'))
  else {
    if (data.tgym_routine_exchange === 2) {
      for (const key of ['backoffRepsMode','strictReps','restSec','restAdvanced','effort','deload']) if (data.rules[key] == null) errors.push(issue('Instrucciones',4,key,'Version 2 requires the source preference context. Restore this field from the original TGym export or obtain a new version 2 file.'))
      if (obj(data.rules.restAdvanced)) for (const key of ['warmup','supersetMove','supersetRound']) if (data.rules.restAdvanced[key] == null) errors.push(issue('Instrucciones',4,`restAdvanced.${key}`,'Version 2 requires the original source rest value in seconds.'))
      if (obj(data.rules.deload) && typeof data.rules.deload.on !== 'boolean') errors.push(issue('Instrucciones',4,'deload.on','Version 2 requires the source deload enabled flag.'))
    }
    if (data.rules.backoffRepsMode != null && !['same', 'increased'].includes(data.rules.backoffRepsMode)) errors.push(issue('Instrucciones', 4, 'Regla Back-off', 'Use same or increased'))
    number(data.rules.restSec, 0, 86400, 'Instrucciones', 4, 'Rest seconds', true)
    if (data.rules.strictReps != null && typeof data.rules.strictReps !== 'boolean') errors.push(issue('Instrucciones', 4, 'strictReps', 'Expected boolean'))
    if (data.rules.effort != null && !['none', 'rir', 'rpe'].includes(data.rules.effort)) errors.push(issue('Instrucciones', 4, 'effort', 'Unknown effort scale'))
    number(data.rules.step, 0.001, 100000, 'Instrucciones', 4, 'step')
    if (data.rules.warmup != null && typeof data.rules.warmup !== 'boolean') errors.push(issue('Instrucciones', 4, 'warmup', 'Expected boolean'))
    if (data.rules.restAdvanced != null) {
      if (!obj(data.rules.restAdvanced)) errors.push(issue('Instrucciones', 4, 'restAdvanced', 'Expected rest settings object'))
      else for (const [key, value] of Object.entries(data.rules.restAdvanced)) { if (!['warmup', 'supersetMove', 'supersetRound'].includes(key)) errors.push(issue('Instrucciones', 4, key, 'Unknown rest setting')); number(value, 0, 86400, 'Instrucciones', 4, key, true) }
    }
    if (data.rules.deload != null) {
      const deload = data.rules.deload
      if (!obj(deload)) errors.push(issue('Instrucciones', 4, 'deload', 'Use a deload settings object'))
      else {
        for (const key of ['on', 'notifications']) if (deload[key] != null && typeof deload[key] !== 'boolean') errors.push(issue('Instrucciones', 4, `deload.${key}`, 'Expected boolean'))
        number(deload.normalWeeks, 1, 24, 'Instrucciones', 4, 'deload.normalWeeks', true)
        number(deload.deloadWeeks, 1, 4, 'Instrucciones', 4, 'deload.deloadWeeks', true)
        number(deload.loadPct, 50, 100, 'Instrucciones', 4, 'deload.loadPct')
        number(deload.setPct, 20, 100, 'Instrucciones', 4, 'deload.setPct')
        number(deload.targetRir, 0, 10, 'Instrucciones', 4, 'deload.targetRir')
        if (deload.startDate != null && !validDate(deload.startDate)) errors.push(issue('Instrucciones', 4, 'deload.startDate', 'Use a valid date YYYY-MM-DD'))
        if (deload.on === true && deload.startDate == null) errors.push(issue('Instrucciones', 4, 'deload.startDate', 'An enabled deload cycle needs its original start date YYYY-MM-DD'))
      }
    }
    for (const key of Object.keys(data.rules)) if (!rulesKeys.includes(key)) errors.push(issue('Instrucciones', 4, key, 'Unknown profile rule'))
  }
  if (needsLegacyUnit && !['kg', 'lb'].includes(legacyUnit)) errors.push(issue('Instrucciones', 3, 'Unidad', 'This legacy plan did not record its weight unit. Choose the original kg or lb unit before importing; no unit can be inferred safely.'))
  const reservations = identityReservations(S), reservedEx = new Set([...reservations.exercises, ...incoming.keys()]), catalogPlan = [], exerciseIdMap = {}
  if (!obj(exerciseMappings)) errors.push(issue('Ejercicios de rutina', 0, 'Ejercicio', 'Exercise correspondences must be an object'))
  else for (const [id, mapped] of Object.entries(exerciseMappings)) if (!validId(id) || !validId(mapped) || !current.has(mapped)) errors.push(issue('Ejercicios de rutina', used.get(id) || 0, 'Ejercicio', 'Mapping does not exist in your catalog or has an unsafe ID'))
  for (const [sourceId, row] of used) {
    const source = incoming.get(sourceId), mapped = ownValue(exerciseMappings, sourceId)
    let targetId, action = 'reuse', definition
    if (source?.custom) {
      if (data.tgym_routine_exchange === 2 && !obj(source.definition)) errors.push(issue('Catálogo', data.catalog.indexOf(source) + 2, 'Definición', 'Version 2 requires a portable definition for each used custom exercise. Restore the original metadata or explicitly map it to an existing exercise.'))
      definition = customDefinition(source)
      for (const problem of customTransferIssues(definition, {version:data.tgym_routine_exchange})) errors.push(issue('Catálogo', data.catalog.indexOf(source) + 2, problem.field, problem.message))
    }
    if (mapped && validId(mapped) && current.has(mapped)) { targetId = mapped; action = 'explicit' }
    else if (builtins.has(sourceId) && !source?.custom) targetId = sourceId
    else if (source?.custom) {
      const exact = [...current.values()].filter(ex => ex.custom && equal(definitionIdentity(ex), definitionIdentity(source)))
      if (exact.some(ex => ex.id === sourceId)) targetId = sourceId
      else if (exact.length === 1) targetId = exact[0].id
      else if (exact.length > 1) unresolved.push({ id: sourceId, name: source.n, sheet: 'Ejercicios de rutina', row, candidates: exact.map(ex => ex.id), reason: 'Several complete custom definitions match. Select the intended destination exercise explicitly.' })
      else {
        action = 'create'
        if (reservations.exercises.includes(sourceId)) {
          targetId = freshTransferId('transfer-ex', {sourceId, definition:definitionIdentity(source)}, reservedEx)
          conflicts.push({ key:`catalog:${sourceId}`, kind:'catalog', id:sourceId, sourceId, targetId, name:source.n, canMap:true, allowedChoices:['copy'] })
        } else targetId = sourceId
      }
    } else {
      const exact = source ? CATALOGUE.filter(ex => ex.n === source.n) : []
      if (exact.length === 1) targetId = exact[0].id
      else unresolved.push({ id:sourceId, name:source?.n || sourceId, sheet:'Ejercicios de rutina', row, candidates:exact.map(ex => ex.id), reason:exact.length ? 'Several original names match. Select the intended exercise explicitly.' : 'Unknown original identity. Select its correspondence explicitly; display aliases are not identities.' })
    }
    if (!targetId) continue
    exerciseIdMap[sourceId] = targetId
    const record = { sourceId, targetId, action, source:source || {id:sourceId,n:builtins.get(targetId)?.n,custom:false}, ...(definition ? {definition} : {}) }
    catalogPlan.push(record)
    if (action === 'explicit') continue
    if (Object.hasOwn(S.exerciseAliases || {}, targetId) && (source?.aliasPresent || source?.alias) && ownValue(S.exerciseAliases, targetId) !== source.alias) conflicts.push({ key:`alias:${sourceId}`, kind:'alias', id:targetId, sourceId, name:source.n, allowedChoices:['keep','replace'] })
    if (Object.hasOwn(S.exNotes || {}, targetId) && source?.libraryNote != null && ownValue(S.exNotes, targetId) !== source.libraryNote) conflicts.push({ key:`note:${sourceId}`, kind:'note', id:targetId, sourceId, name:source.n, allowedChoices:['keep','replace'] })
  }
  if (!errors.length) {
    for (const routine of data.routines) for (const ex of routine.ex) if (exerciseIdMap[ex.id]) ex.id = exerciseIdMap[ex.id]
    const resolved = catalogPlan.map(record => {
      const ex = record.action === 'explicit' ? current.get(record.targetId) : record.source
      return {...clone(ex), id:record.targetId, ...(ex.custom ? {definition:{...customDefinition(ex),id:record.targetId}} : {}), selector:`${ex.n} [${record.targetId}]`}
    })
    data.catalog = [...new Map([...data.catalog.filter(ex => !used.has(ex.id)), ...resolved].map(ex => [ex.id, ex])).values()]
    const sourceContext = {...(data.tgym_routine_exchange === 1 ? S : {}), ...data.rules, unit:data.unit || S.unit || 'kg', customEx:catalogPlan.filter(ex => ex.definition).map(ex => ({...ex.definition,id:ex.targetId}))}
    data.routines = data.routines.map((routine,index) => {
      try {
        const snapshot = materializeRoutinePrescription(sourceContext, routine)
        return {...routine,...snapshot,ex:routine.ex.map((ex,ei) => ({...ex,...snapshot.ex[ei]}))}
      } catch (error) { errors.push(issue('Rutinas',index + 2,'Configuración',error.message)); return routine }
    })
    if (data.tgym_routine_exchange === 1) adaptations.push({key:'legacy-defaults',field:'rules',message:Object.keys(data.rules).length ? 'Legacy version 1: source preferences were applied only to the imported prescriptions. Review the preview before accepting.' : 'Legacy version 1 did not record its source preferences. Missing defaults use the current TGym settings shown in the preview; confirm this adaptation or obtain a version 2 export.',source:clone(data.rules),destination:portableRoutineRules(S)})
    const sourceEffort = effortOf(data.rules), destinationEffort = effortOf(S)
    if (Object.hasOwn(data.rules,'effort') && sourceEffort !== destinationEffort) adaptations.push({key:'effort',field:'effort',message:`Effort scale differs (${sourceEffort} → ${destinationEffort}). Destination preferences remain unchanged; imported RIR prescriptions are preserved.`,source:sourceEffort,destination:destinationEffort})
    const destinationDeload = portableRoutineRules(S).deload
    if (data.rules.deload?.on === true || destinationDeload.on === true) adaptations.push({key:'deload',field:'deload',message:'Deload is enabled in the source or destination. The destination personal calendar, pauses and history determine deload execution; review and accept this adaptation. Destination settings remain unchanged.',source:clone(data.rules.deload || {on:false}),destination:destinationDeload})
    if (!errors.length && !unresolved.length) {
      const semantic = new Map(), reservedRoutines = new Set(reservations.routines)
      const targetContext = {...S,customEx:[...(S.customEx || []), ...catalogPlan.filter(ex => ex.action === 'create').map(ex => ({...ex.definition,id:ex.targetId}))]}
      for (const routine of S.routines || []) {
        // Unsupported fields in an unrelated local plan remain untouched. Such a
        // plan cannot be proven equivalent; its ID/name still requires review.
        try { const key = routineIdentity(targetContext,routine), matches = semantic.get(key) || []; matches.push(routine.id); semantic.set(key,matches) } catch { /* preserve the local plan */ }
      }
      for (const r of data.routines) {
        const existing = (S.routines || []).find(old => old.id === r.id), sameNameIds = (S.routines || []).filter(old => old.name === r.name && old.id !== r.id).map(old => old.id)
        const semanticIds = semantic.get(routineIdentity(targetContext,convertedRoutine(r,data.unit,S.unit || 'kg'))) || [], reserved = reservedRoutines.has(r.id) && !existing
        const replaceCandidates = [...new Set([...sameNameIds,...semanticIds])], existingId = existing?.id || (!reserved && replaceCandidates.length === 1 ? replaceCandidates[0] : undefined)
        if (existing || sameNameIds.length || semanticIds.length || reserved) conflicts.push({key:`routine:${r.id}`,kind:'routine',id:r.id,name:r.name,existingId,sameNameIds,semanticIds,reserved,allowedChoices:existingId ? ['keep','copy','replace'] : ['keep','copy']})
      }
    }
  }
  const sourceUnit = data.unit
  if (['kg', 'lb'].includes(sourceUnit) && sourceUnit !== (S.unit || 'kg')) {
    conflicts.push({key:'unit',kind:'unit',name:`${sourceUnit} → ${S.unit || 'kg'}`,allowedChoices:['convert']})
    if (!errors.length && ownValue(choices,'unit') === 'convert') { data.routines = data.routines.map(routine => convertedRoutine(routine,sourceUnit,S.unit || 'kg')); data.unit = S.unit || 'kg' }
  }
  if (!errors.length && new TextEncoder().encode(JSON.stringify(data)).length > ROUTINE_EXCHANGE_MAX_BYTES) errors.push(issue('JSON',0,'Archivo','The normalized routine exchange exceeds 15 MiB. Export fewer selected routines or reduce embedded media.'))
  return { data, sourceData, sourceUnit, needsLegacyUnit, legacyUnit, locations, exerciseMappings: obj(exerciseMappings) ? clone(exerciseMappings) : {}, exerciseIdMap, catalogPlan, errors, unresolved, conflicts, adaptations, valid: !errors.length && !unresolved.length, reviewKey: routineExchangeReviewKey(S), routineCount: data.routines.length, exerciseCount: data.routines.reduce((n, r) => n + (Array.isArray(r?.ex) ? r.ex.length : 0), 0) }
}

/** Computes a complete draft before mutation. The UI commits it in ONE store.update. */
export function applyRoutineExchange(S, validation, { conflicts: choices = {}, schedule = false, acceptAdaptations = false, exerciseMappings = validation.exerciseMappings || {}, legacyUnit = validation.legacyUnit } = {}) {
  if (validation.reviewKey !== routineExchangeReviewKey(S)) throw new Error('Your plan changed during review. Review the current conflicts again before importing.')
  const checked = validateRoutineExchange(validation.sourceData || validation.data, S, { exerciseMappings, legacyUnit, conflicts:choices, locations:validation.locations })
  if (!checked.valid) throw new Error('Resolve all errors and exercise mappings before importing')
  for (const conflict of checked.conflicts) {
    if (!conflict.allowedChoices.includes(ownValue(choices, conflict.key))) throw new Error(`Choose how to resolve ${conflict.name}`)
  }
  if (checked.adaptations.length && !acceptAdaptations) throw new Error('Review and explicitly accept the listed preference adaptations before importing')
  const data = checked.data, next = clone(S), map = new Map()
  const accepted = data.routines.filter(r => choices[`routine:${r.id}`] !== 'keep')
  if (!accepted.length) return next
  next.routines ||= []; next.customEx ||= []; next.exerciseAliases ||= {}; next.exNotes ||= {}
  // Scope metadata to accepted SOURCE references. An explicit correspondence
  // adopts destination identity; it does not replace its definition or metadata.
  const sourceRoutines = new Map((convertedLegacy(checked.sourceData,legacyUnit).routines || []).map(r => [r.id, r]))
  const used = new Set(accepted.flatMap(r => sourceRoutines.get(r.id).ex.map(e => e.id)))
  for (const record of checked.catalogPlan) {
    const {sourceId,targetId,source:ex,action,definition} = record
    if (!used.has(sourceId) || action === 'explicit') continue
    if (action === 'create') next.customEx.push({...clone(definition),id:targetId})
    if ((ex.aliasPresent || ex.alias) && choices[`alias:${sourceId}`] !== 'keep') next.exerciseAliases[targetId] = ex.alias
    if (ex.libraryNote != null && choices[`note:${sourceId}`] !== 'keep') next.exNotes[targetId] = ex.libraryNote
  }
  const reserved = new Set([...identityReservations(S).routines,...data.routines.map(r => r.id)])
  for (const incoming of data.routines) {
    const conflict = checked.conflicts.find(c => c.key === `routine:${incoming.id}`), choice = choices[`routine:${incoming.id}`]
    if (conflict && choice === 'keep') continue
    const r = convertedRoutine(incoming,data.unit,S.unit || 'kg')
    if (conflict && choice === 'copy') r.id = freshTransferId('transfer-r',incoming,reserved)
    if (conflict && choice === 'replace') r.id = conflict.existingId
    map.set(incoming.id, r.id)
    const index = next.routines.findIndex(old => old.id === r.id)
    if (index >= 0) next.routines[index] = r
    else next.routines.push(r)
  }
  const importedIds = new Set(map.values())
  next.routineOrder = [...new Set([...(next.routineOrder || next.routines.map(r => r.id)).filter(id => !importedIds.has(id)), ...(data.routineOrder || data.routines.map(r => r.id)).map(id => map.get(id)).filter(Boolean)])]
  if (schedule) for (const field of ['week', 'dayPlan']) {
    next[field] ||= {}
    for (const [key, value] of Object.entries(next[field])) next[field][key] = routineIds(value).filter(id => !importedIds.has(id))
    for (const [key, value] of Object.entries(data[field])) {
      const imported = routineIds(value).map(id => map.get(id)).filter(Boolean)
      const existing = routineIds(next[field][key])
      next[field][key] = [...new Set([...existing, ...imported])]
    }
  }
  return next
}

export const EXCHANGE_HEADERS = {
  Rutinas: ['ID', 'Nombre', 'Orden', 'Semana (JSON)', 'Fechas (JSON)', 'Notas', 'Progresión', 'Descanso (s)', 'Descanso warm-up (s)', 'Descanso superset paso (s)', 'Descanso superset ronda (s)', 'Configuración (JSON)'],
  'Ejercicios de rutina': ['Instancia', 'Rutina ID', 'Ejercicio (lista)', 'Orden', 'Superset', 'Notas', 'Modo', 'Por lado', 'Reps por lado', 'Progresión', 'Incremento', 'Peso corporal', 'Reps estrictas', 'AMRAP', 'Descanso superset paso (s)', 'Descanso superset ronda (s)', 'Intensificador (JSON)', 'Configuración (JSON)'],
  Series: ['Instancia', 'Orden', 'Tipo', 'Reps mín.', 'Reps máx.', 'Peso', 'Unidad', 'RIR mín.', 'RIR máx.', 'Descanso (s)', 'Top asociado', 'Reducción (%)', 'Regla Back-off', 'Back-off automático', 'Tiempo (s)', 'Cardio (min)', 'Velocidad (km/h)'],
  Catálogo: ['ID', 'Nombre original', 'Apodo', 'Personalizado', 'Selector', 'Notas de biblioteca'],
}
export const ROUTINE_EXCHANGE_MAX_BYTES = 15 * 1024 * 1024
const WORKBOOK_ROW_LIMIT = 20000
const XLSX_XML_MAX_BYTES = 128 * 1024 * 1024
const METADATA_MAX_BYTES = 45 * 1024 * 1024
const legacyHeaderLength = { Rutinas: 6, 'Ejercicios de rutina': 10, Series: 17, Catálogo: 6 }
const routineColumnKeys = ['id', 'name', 'ex', 'note', 'prog', 'restSec', 'warmupRestSec', 'supersetMoveRestSec', 'supersetRoundRestSec']
const exerciseColumnKeys = ['id', 'sg', 'note', 'mode', 'side', 'repsPerSide', 'prog', 'inc', 'bodyweight', 'strictReps', 'amrap', 'supersetMoveRestSec', 'supersetRoundRestSec', 'intensifier', 'sets', 'warmupSets', 'setScheme', 'topSets', 'backoffSets', 'reps', 'repsMin', 'repRange', 'topRepsMin', 'topRepsMax', 'backoffRepsMin', 'backoffRepsMax', 'weight', 'restSec', 'warmupRestSec', 'targetRir', 'targetRirMin', 'targetRirMax', 'topRir', 'topRirMin', 'topRirMax', 'backoffRir', 'backoffRirMin', 'backoffRirMax', 'backoffPct', 'autoBackoffReps', 'backoffRepsMode', 'backoffRepsOverride', 'sec', 'min', 'speed']
const extraConfig = (record, keys) => Object.fromEntries(Object.entries(record).filter(([key]) => !keys.includes(key)))
// Old editors saved the current profile mode as a snapshot. Only a marked rule
// is a per-exercise choice; presentation follows the same helper as execution.
const effectiveBackoff = (e, rules) => withBackoffRepsMode(e, rules)
const backoffRule = e => e.backoffRepsOverride === true ? e.backoffRepsMode || `legacy:${backoffRepOffsetFor(e)}` : 'inherit'
function scheduleFor(data, field, id) { return Object.fromEntries(Object.entries(data[field] || {}).filter(([, ids]) => routineIds(ids).includes(id)).map(([key, ids]) => [key, routineIds(ids).indexOf(id)])) }
const sourceMode = (e, definition) => ['reps', 'time', 'cardio'].includes(e.mode) ? e.mode : definition?.bp === 'cardio' ? 'cardio' : 'reps'
export function routineExchangeRows(data) {
  const rows = { Rutinas: [], 'Ejercicios de rutina': [], Series: [], Catálogo: data.catalog.map(ex => [ex.id, ex.n, ex.alias || '', !!ex.custom, ex.selector || `${ex.n} [${ex.id}]`, ex.libraryNote || '']) }
  const source = new Map(data.catalog.map(ex => [ex.id, ex]))
  for (const [ri, routine] of data.routines.entries()) {
    rows.Rutinas.push([routine.id, routine.name, ri + 1, JSON.stringify(scheduleFor(data, 'week', routine.id)), JSON.stringify(scheduleFor(data, 'dayPlan', routine.id)), routine.note || '', routine.prog ?? '', routine.restSec ?? '', routine.warmupRestSec ?? '', routine.supersetMoveRestSec ?? '', routine.supersetRoundRestSec ?? '', JSON.stringify(extraConfig(routine, routineColumnKeys))])
    for (const [ei, e] of routine.ex.entries()) {
      const instance = `${routine.id}:${ei + 1}`, ex = source.get(e.id), definition = ex?.definition || builtins.get(e.id) || ex, mode = sourceMode(e, definition), loadingStep = loadingStepFor(e, data.unit, definition)
      rows['Ejercicios de rutina'].push([instance, routine.id, ex?.selector || `${ex?.n || e.id} [${e.id}]`, ei + 1, e.sg || '', e.note || '', mode, !!e.side, !!e.repsPerSide, e.prog || '', e.inc ?? '', e.bodyweight ?? '', e.strictReps ?? '', e.amrap ?? '', e.supersetMoveRestSec ?? '', e.supersetRoundRestSec ?? '', e.intensifier ? JSON.stringify(e.intensifier) : '', JSON.stringify(extraConfig(e, exerciseColumnKeys))])
      const effective = effectiveBackoff(e, data.rules)
      if (mode === 'reps' && e.intensifier?.type === 'restpause') {
        const activation = Math.max(1, Math.round(e.reps) || 1), total = Math.max(1, Math.round(e.intensifier.totalReps) || 1), rir = targetRirRangeFor(e)
        rows.Series.push([instance, 1, 'Warm-up', activation, activation, e.weight ?? '', data.unit, '', '', restSeconds({ state: data.rules, routine, target: e, warmup: true }), '', '', '', '', '', '', ''])
        rows.Series.push([instance, 2, 'Working', total, total, e.weight ?? '', data.unit, rir?.min ?? '', rir?.max ?? '', restSeconds({ state: data.rules, routine, target: e }), '', '', '', '', '', '', ''])
        continue
      }
      const groups = [...Array.from({ length: mode === 'cardio' ? 0 : e.warmupSets || 0 }, () => 'Warm-up'), ...(e.setScheme === 'topback' ? [...Array.from({ length: e.topSets || 1 }, () => 'Top'), ...Array.from({ length: e.backoffSets || 2 }, () => 'Back-off')] : Array.from({ length: e.sets || 1 }, () => 'Working'))]
      groups.forEach((type, index) => {
        const role = type === 'Top' ? 'top' : type === 'Back-off' ? 'backoff' : null
        const bounds = repBounds(effective, role), rir = type === 'Warm-up' ? null : targetRirRangeFor(e, role)
        const weight = type === 'Back-off' ? backoffWeightFor(e.weight, effective, loadingStep) : e.weight
        rows.Series.push([instance, index + 1, type, mode === 'reps' && type !== 'Warm-up' ? bounds.min : '', mode === 'reps' && type !== 'Warm-up' ? bounds.max : '', type === 'Warm-up' || mode === 'cardio' ? '' : weight ?? '', data.unit, mode === 'reps' ? rir?.min ?? '' : '', mode === 'reps' ? rir?.max ?? '' : '', restSeconds({ state: data.rules, routine, target: e, warmup: type === 'Warm-up' }), type === 'Back-off' ? `${instance}:Top` : '', type === 'Back-off' ? e.backoffPct ?? 10 : '', type === 'Back-off' ? backoffRule(e) : '', type === 'Back-off' ? effective.autoBackoffReps !== false : '', mode === 'time' && type !== 'Warm-up' ? e.sec ?? 45 : '', mode === 'cardio' ? e.min ?? 20 : '', mode === 'cardio' ? e.speed ?? 8 : ''])
      })
    }
  }
  return rows
}
const excel = async () => { const mod = await import('exceljs'); return mod.default || mod }
function aborted(signal) { if (signal?.aborted) throw new DOMException('Canceled', 'AbortError') }
export async function createRoutineWorkbook(data, { signal } = {}) {
  aborted(signal)
  if (new TextEncoder().encode(JSON.stringify(data)).byteLength > ROUTINE_EXCHANGE_MAX_BYTES) throw new Error('This transfer exceeds the 15 MiB import limit. Select fewer routines or split the transfer into separate files.')
  const Excel = await excel(), workbook = new Excel.Workbook()
  workbook.creator = 'TGym'; workbook.created = new Date(); workbook.calcProperties.fullCalcOnLoad = true
  const instructions = workbook.addWorksheet('Instrucciones', { views: [{ showGridLines: false }] })
  instructions.columns = [{ width: 34 }, { width: 110 }]
  const lines = [
    ['TGym routine exchange', 'Plantilla editable de rutinas; no contiene resultados de entrenamientos.'], ['Versión', data.tgym_routine_exchange], ['Unidad', data.unit],
    ['Obligatorios', 'Rutinas: ID, Nombre, Orden. Ejercicios: Instancia única, Rutina ID, Ejercicio de la lista, Orden. Series: Instancia, Orden, Tipo, Unidad y prescripción según modo.'],
    ['Ejercicios', 'Elija Ejercicio (lista) en Ejercicios de rutina. El selector conserva el ID internamente; los apodos están separados en Catálogo. No cambie los ID del Catálogo.'],
    ['Series', 'Una fila por serie prescrita. Tipos: Warm-up, Working, Top, Back-off. Reps mín./máx. iguales = objetivo fijo. RIR 0–10. kg/lb. Descanso en segundos. No escriba resultados registrados.'],
    ['Reglas', 'Working comparte reps/peso/RIR; Top comparte su rango y RIR; Back-off comparte su rango/RIR y reducción 1–50%. TGym no admite objetivos independientes arbitrarios por fila. Se rechazan diferencias incompatibles.'],
    ['Warm-up', 'Warm-up usa el calentamiento automático de TGym (máximo 5). Peso/reps/RIR vacíos: no se prescribe un objetivo individual. Su descanso sí se puede editar.'],
    ['Back-off', 'Top asociado = Instancia:Top. inherit sigue la preferencia de TGym. same fija mismas reps; increased fija +2 por lado; legacy:N fija el incremento heredado en reps almacenadas. Cambie la regla en todas las filas Back-off de la instancia. Automático false usa el rango independiente.'],
    ['Supersets', 'Use el mismo identificador en al menos dos ejercicios consecutivos de una rutina.'],
    ['Programación', 'Semana (JSON): {"1":0,"3":1}; días 0=domingo…6=sábado, valor=posición de la rutina ese día. Fechas (JSON): {"2026-10-08":0}. {} significa sin programación.'],
    ['Opcionales', 'Notas, Superset, RIR, Por lado, Reps por lado, Progresión (vacía = heredar; off = desactivada). Reposos opcionales vacíos heredan del nivel superior. Un cambio en reps no fija un reposo ni una regla heredada.'],
    ['Añadir filas', 'Copie una fila y cambie Instancia/Orden según corresponda. Las listas se aplican hasta la fila 10001; copie la validación si amplía más. IDs de rutina e instancia son identificadores propios, no IDs de catálogo.'],
    ['Importación', 'Guarde como .xlsx. TGym valida todo, muestra errores por hoja/fila/campo, pide correspondencias/conflictos y guarda atómicamente tras confirmar. También acepta JSON versionado y planes antiguos v1.'],
    ['Importante', 'No borre hojas ni encabezados. No use fórmulas ni enlaces externos. PDF es de lectura y no se importa.'],
    ['Reglas del perfil (JSON)', JSON.stringify(data.rules)],
    ['Preferencia de nombres', data.exerciseNameMode === 'original' ? 'original' : 'aliases'],
    ['Formato de números', 'Escriba números de Excel o decimales sin millares: 22.5 o 22,5. Texto como 1,234 o 1.234 es ambiguo: use una celda numérica, 1234 para mil doscientos treinta y cuatro, o 1.2340 para el decimal. No mezcle separadores. Vacío significa ausente; 0 es explícito.'],
    ['Colores', 'Amarillo: campo obligatorio. Azul claro: editable/opcional. Gris: identificador o configuración técnica. No necesita fórmulas ni macros. IDs propios: use R1 para la rutina, R1:1 para su primera instancia.'],
    ['Primer ejemplo', 'Rutinas: R1, Fuerza, 1, {}, {}. Ejercicios: R1:1, elija R1, elija ejercicio, 1, modo reps. Series: elija R1:1, 1, Working, 8, 8, 20, kg, RIR opcional, descanso 90. Repita para añadir series o rutinas.'],
    ['Avanzado', 'Incremento usa kg/lb en repeticiones y segundos en modo time. Peso corporal, Reps estrictas y AMRAP: true/false, vacío conserva/hereda. La duración cardio usa min y km/h; distancia = min × km/h / 60.'],
    ['Intensificador (JSON)', 'Vacío = ninguno. Dropset: {"type":"dropset","count":2,"pct":20}. Rest-pause: {"type":"restpause","totalReps":12,"restSec":15}; sus Series son una activación Warm-up con reps fijas y un Working con reps totales. Edite las reps de cada fila; el peso compartido se edita en Working. No añada bloques ni resultados realizados.'],
    ['Configuración (JSON)', 'Opciones técnicas existentes: objeto JSON, {} = sin extras. Rutina: emoji, guideSlots y ajustes heredados. Ejercicio: afterRestSec, setRestSec o backoffRepOffset. Use Regla Back-off para elegir una excepción; un offset sin esa intención conserva un snapshot heredado. No duplique campos de columnas.'],
    ['Reglas del perfil', 'El JSON editable de arriba admite backoffRepsMode (same/increased), strictReps, effort (none/rir/rpe), restSec, restAdvanced (warmup/supersetMove/supersetRound), warmup, step y deload. Describe el contexto de origen para las prescripciones importadas; las preferencias globales del receptor no cambian. TGym solicita aceptar explícitamente las adaptaciones necesarias antes de importar.'],
    ['Compatibilidad', 'Formato 2: actualice TGym en el receptor antes de importar. El lector admite archivos anteriores de formato 1. Conserve la hoja técnica _TGym: contiene definiciones, recursos personalizados y opciones originales. Si falta la definición de un personalizado usado, el formato 2 bloquea la importación: restaure la hoja o vuelva a exportar desde TGym. El formato 1 requiere aceptar la advertencia de compatibilidad. Nombres y notas que comienzan por = son texto literal.'],
    ['Días de descanso (JSON)', JSON.stringify(Object.fromEntries(['week', 'dayPlan'].map(field => [field, Object.entries(data[field] || {}).filter(([, ids]) => !routineIds(ids).length).map(([key]) => field === 'week' ? Number(key) : key)])))]
  ]
  for (const [label, value] of lines) if (typeof value === 'string' && value.length > 32767) throw new Error(`Instrucciones, ${label} exceeds Excel's 32767-character cell limit. Export JSON to preserve the full text.`)
  instructions.addRows(lines); instructions.eachRow(row => {
    const wrappedLines = String(row.getCell(2).value ?? '').split(/\r?\n/).reduce((count, paragraph) => count + Math.max(1, Math.ceil(paragraph.length / 90)), 0)
    row.font = { name: 'Arial', size: 11 }; row.alignment = { wrapText: true, vertical: 'top' }
    row.height = Math.min(409, Math.max(44, wrappedLines * 17 + 8))
  }); instructions.getRow(1).font = { name: 'Arial', bold: true, size: 15 }; instructions.getRow(1).height = 30
  const rows = routineExchangeRows(data)
  for (const [name, headers] of Object.entries(EXCHANGE_HEADERS)) {
    if (rows[name].length > WORKBOOK_ROW_LIMIT) throw new Error(`${name}: Excel supports at most ${WORKBOOK_ROW_LIMIT} data rows. Select fewer routines or export JSON.`)
    for (const [rowIndex, values] of rows[name].entries()) for (const [column, value] of values.entries()) if (typeof value === 'string' && value.length > 32767) throw new Error(`${name}, row ${rowIndex + 2}, ${headers[column]} exceeds Excel's 32767-character cell limit. Export JSON to preserve the full text, or shorten this field.`)
    const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1, xSplit: name === 'Ejercicios de rutina' ? 3 : 1, showGridLines: false }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:1' } })
    sheet.columns = headers.map(header => ({ header, width: /Notas/.test(header) ? 70 : /Nombre/.test(header) ? 48 : /Ejercicio|JSON|Selector/.test(header) ? 45 : 19 }))
    const tableNames = { Rutinas: 'TGymRoutines', 'Ejercicios de rutina': 'TGymRoutineExercises', Series: 'TGymSets', Catálogo: 'TGymCatalogue' }
    sheet.addTable({ name: tableNames[name], ref: 'A1', headerRow: true, totalsRow: false, style: { theme: 'TableStyleMedium4', showRowStripes: false }, columns: headers.map(name => ({ name, filterButton: true })), rows: rows[name].length ? rows[name] : [headers.map(() => null)] })
    sheet.getRow(1).height = 46; sheet.getRow(1).font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }; sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF35452A' } }
    sheet.eachRow((row, index) => {
      row.alignment = { vertical: 'top', wrapText: true }
      if (index > 1) {
        const required = { Rutinas: [1, 2, 3], 'Ejercicios de rutina': [1, 2, 3, 4, 7], Series: [1, 2, 3, 7], Catálogo: [1, 2, 5] }[name]
        const technical = { Rutinas: [1, 12], 'Ejercicios de rutina': [1, 2, 17, 18], Series: [1, 11], Catálogo: [1, 2, 4, 5] }[name]
        row.eachCell({ includeEmpty: true }, (cell, column) => {
          const color = technical.includes(column) ? 'FFF0F1F3' : required.includes(column) ? 'FFFFEDBB' : 'FFEFF6FF'
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } }
          cell.font = { name: 'Arial', size: 11, color: { argb: technical.includes(column) ? 'FF515B63' : 'FF202B35' } }
          if (typeof cell.value === 'string') cell.numFmt = '@'
          else if (typeof cell.value === 'number') cell.numFmt = 'General'
        })
        const lineCount = Math.max(...headers.map((_, column) => String(row.getCell(column + 1).value ?? '').split(/\r?\n/).reduce((total, text) => total + Math.max(1, Math.ceil(Array.from(text).length / (sheet.getColumn(column + 1).width - 4))), 0)))
        row.height = Math.max(28, Math.min(409, lineCount * 17 + 8))
      }
    })
  }
  const list = (sheet, range, formula) => workbook.getWorksheet(sheet).dataValidations.add(range, { type: 'list', allowBlank: true, formulae: [formula], showErrorMessage: true, errorStyle: 'stop', errorTitle: 'Valor no permitido', error: 'Elija un valor de la lista.' })
  workbook.definedNames.add(`'Catálogo'!$E$2:$E$${Math.max(2, rows.Catálogo.length + 1)}`, 'TGymExercises')
  workbook.definedNames.add("'Rutinas'!$A$2:$A$10001", 'TGymRoutineIDs')
  workbook.definedNames.add("'Ejercicios de rutina'!$A$2:$A$10001", 'TGymInstances')
  list('Ejercicios de rutina', 'B2:B10001', 'TGymRoutineIDs'); list('Series', 'A2:A10001', 'TGymInstances')
  list('Ejercicios de rutina', 'C2:C10001', 'INDIRECT("TGymCatalogue[Selector]")')
  list('Ejercicios de rutina', 'G2:G10001', '"reps,time,cardio"'); list('Ejercicios de rutina', 'H2:I10001', '"true,false"'); list('Ejercicios de rutina', 'J2:J10001', `"${PROGS.join(',')}"`)
  list('Series', 'C2:C10001', '"Warm-up,Working,Top,Back-off"'); list('Series', 'G2:G10001', '"kg,lb"'); list('Series', 'M2:M10001', '"inherit,same,increased,legacy:1,legacy:2,legacy:3,legacy:4,legacy:5,legacy:6,legacy:7,legacy:8,legacy:9,legacy:10"'); list('Series', 'N2:N10001', '"true,false"')
  list('Rutinas', 'G2:G10001', `"${PROGS.join(',')}"`); list('Ejercicios de rutina', 'L2:N10001', '"true,false"')
  list('Instrucciones', 'B17', '"aliases,original"')
  const decimal = (sheet, range, max, integer = false, min = 0) => workbook.getWorksheet(sheet).dataValidations.add(range, { type: integer ? 'whole' : 'decimal', operator: 'between', allowBlank: true, formulae: [min, max], showErrorMessage: true, errorStyle: 'stop', errorTitle: 'Número no permitido', error: `Use ${integer ? 'un entero' : 'un número'} entre ${min} y ${max}.` })
  decimal('Rutinas', 'C2:C10001', 500, true, 1); decimal('Rutinas', 'H2:K10001', 86400, true)
  decimal('Ejercicios de rutina', 'D2:D10001', 1000, true, 1); decimal('Ejercicios de rutina', 'K2:K10001', 1000000); decimal('Ejercicios de rutina', 'O2:P10001', 86400, true)
  decimal('Series', 'B2:B10001', 1000, true, 1); decimal('Series', 'D2:E10001', 100000, true, 1); decimal('Series', 'F2:F10001', 1000000); decimal('Series', 'H2:I10001', 10); decimal('Series', 'J2:J10001', 86400, true); decimal('Series', 'L2:L10001', 50, false, 1); decimal('Series', 'O2:Q10001', 1000000)
  const metadata = workbook.addWorksheet('_TGym', { state: 'veryHidden' })
  const serialized = JSON.stringify({ metadataVersion: data.tgym_routine_exchange, data, rows })
  for (let start = 0; start < serialized.length;) {
    let end = Math.min(start + 30000, serialized.length)
    // Keep Unicode surrogate pairs together across independently encoded XML cells.
    if (end < serialized.length && /[\uD800-\uDBFF]/.test(serialized[end - 1])) end--
    metadata.addRow([serialized.slice(start, end)]); start = end
  }
  aborted(signal)
  return workbook
}

function scalar(cell) { const value = cell.value; if (value == null) return ''; if (typeof value === 'object') throw new Error('Formulas, rich text and links are not supported in import cells; paste plain values'); return value }
const bool = value => value === true || value === 'true' ? true : value === false || value === 'false' ? false : value === '' ? false : null
function numeric(value) {
  if (value === '' || typeof value === 'string' && !value.trim()) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN
  // Single decimal separator, no grouping/currency/exponents; never infer a locale.
  return typeof value === 'string' && !/^\d{1,3}[.,]\d{3}$/.test(value.trim()) && /^(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(value.trim()) ? Number(value.trim().replace(',', '.')) : NaN
}
function inspectWorkbookArchive(buffer) {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  if (!bytes.byteLength || bytes.byteLength > ROUTINE_EXCHANGE_MAX_BYTES) throw new Error('Choose a nonempty file no larger than 15 MiB. Select fewer routines or split the transfer into separate files.')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let end = bytes.length - 22
  for (; end >= Math.max(0, bytes.length - 65557); end--) if (view.getUint32(end, true) === 0x06054b50) break
  if (end < 0 || view.getUint32(end, true) !== 0x06054b50) throw new Error('The Excel file is damaged or is not a valid .xlsx workbook. Download the TGym template again.')
  const entries = view.getUint16(end + 10, true), centralSize = view.getUint32(end + 12, true), centralStart = view.getUint32(end + 16, true)
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || entries === 65535 || centralStart + centralSize > end) throw new Error('Unsupported or damaged Excel archive. Save it as a standard .xlsx file in Excel or export JSON from TGym.')
  let offset = centralStart, expanded = 0
  for (let index = 0; index < entries; index++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) throw new Error('The Excel archive is damaged. Export the original file again.')
    const size = view.getUint32(offset + 24, true)
    if (size === 0xffffffff || (expanded += size) > XLSX_XML_MAX_BYTES) throw new Error('Excel contents exceed the 128 MiB expanded-file limit. Select fewer routines or split the transfer into separate files.')
    offset += 46 + view.getUint16(offset + 28, true) + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true)
  }
  if (offset !== centralStart + centralSize) throw new Error('The Excel archive is damaged. Export the original file again.')
}
export async function parseRoutineWorkbook(buffer) {
  inspectWorkbookArchive(buffer)
  const Excel = await excel(), workbook = new Excel.Workbook()
  try { await workbook.xlsx.load(buffer) } catch { throw new Error('The Excel file is damaged or is not a valid .xlsx workbook. Open the original file or download the TGym template again.') }
  const errors = [], warnings = [], sheetRows = {}, providedColumns = {}
  const version = workbook.getWorksheet('Instrucciones')?.getCell('B2').value, unit = workbook.getWorksheet('Instrucciones')?.getCell('B3').value
  if (![1, 2].includes(version)) errors.push(issue('Instrucciones', 2, 'Versión', 'Unsupported or missing format version. TGym supports versions 1 and 2; update TGym or export a compatible file.'))
  let original = null
  try {
    const meta = workbook.getWorksheet('_TGym')
    if (meta) {
      const chunks = meta.getColumn(1).values.slice(1)
      if (chunks.some(value => typeof value !== 'string') || chunks.reduce((sum, value) => sum + value.length, 0) > METADATA_MAX_BYTES) throw new Error()
      const serialized = chunks.join('')
      if (new TextEncoder().encode(serialized).byteLength > METADATA_MAX_BYTES) throw new Error()
      original = JSON.parse(serialized)
      if (!obj(original) || !obj(original.data) || !Array.isArray(original.data.routines) || !Array.isArray(original.data.catalog) || !obj(original.rows) || Object.entries(EXCHANGE_HEADERS).some(([name]) => !Array.isArray(original.rows[name]) || original.rows[name].some(row => !Array.isArray(row))) || original.data.routines.some(r => !obj(r) || typeof r.id !== 'string' || !Array.isArray(r.ex) || r.ex.some(e => !obj(e) || typeof e.id !== 'string')) || original.data.catalog.some(ex => !obj(ex) || typeof ex.id !== 'string')) throw new Error()
      if (original.data.tgym_routine_exchange !== version || original.metadataVersion != null && original.metadataVersion !== version || version === 2 && original.metadataVersion !== 2) throw new Error()
      const unsafe = []; walkSafe(original, unsafe, '_TGym')
      if (unsafe.length) throw new Error()
    }
  } catch { original = null; errors.push(issue('_TGym', 1, '', 'Corrupt or incompatible preservation metadata. Its format version must match Instrucciones B2. Export the original plan again; do not import a damaged workbook.')) }
  for (const [name, headers] of Object.entries(EXCHANGE_HEADERS)) {
    const sheet = workbook.getWorksheet(name); sheetRows[name] = []
    if (!sheet) { errors.push(issue(name, 1, '', 'Required sheet is missing')); continue }
    const headerRow = sheet.getRow(1)
    let count = headerRow.cellCount
    while (count > 0 && !headerRow.getCell(count).value) count--
    if (count < legacyHeaderLength[name] || count > headers.length || !headers.slice(0, count).every((header, index) => headerRow.getCell(index + 1).value === header)) { errors.push(issue(name, 1, '', 'Required headers were changed. Download the TGym template and preserve the headers.')); continue }
    providedColumns[name] = count
    if (sheet.rowCount > WORKBOOK_ROW_LIMIT + 1) { errors.push(issue(name, 2, '', `Maximum ${WORKBOOK_ROW_LIMIT} rows per sheet. Select fewer routines or use JSON.`)); continue }
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return
      const values = headers.map((header, index) => {
        try { return scalar(row.getCell(index + 1)) }
        catch (error) { errors.push(issue(name, rowNumber, header, error.message)); return '' }
      })
      if (values.some(value => value !== '' && !(typeof value === 'string' && !value.trim()))) sheetRows[name].push({ values, row: rowNumber })
    })
  }
  const data = { tgym_routine_exchange: version, unit, exerciseNameMode: original?.data?.exerciseNameMode || 'aliases', routines: [], routineOrder: [], week: {}, dayPlan: {}, catalog: [], rules: clone(original?.data?.rules || {}) }
  const originals = new Map((original?.data?.routines || []).map(r => [r.id, r]))
  const baselines = original?.rows || {}, baselineExercises = new Map((baselines['Ejercicios de rutina'] || []).map(row => [row[0], row]))
  const changed = (sheet, row, column, key) => { if (providedColumns[sheet] <= column) return false; const old = baselines[sheet]?.find(value => value[0] === key); return !old || !equal(old[column] ?? '', row[column]) }
  const text = (value, sheet, row, field, required = false) => {
    if (typeof value !== 'string' || required && !value.trim()) errors.push(issue(sheet, row, field, required ? 'Required text is missing or has a nontext type' : 'Use plain text'))
  }
  const config = (value, sheet, row, field, excluded = []) => {
    try {
      if (typeof value !== 'string') throw new Error()
      const parsed = value.trim() ? JSON.parse(value) : {}
      if (!obj(parsed) || Object.keys(parsed).some(key => excluded.includes(key))) throw new Error()
      const unsafe = []; walkSafe(parsed, unsafe)
      if (unsafe.length) throw new Error()
      return parsed
    } catch { errors.push(issue(sheet, row, field, 'Use a plain JSON object with supported options. Do not repeat fields represented by other columns or identifiers.')); return {} }
  }
  const mergeExtras = (target, values, sheet, row, column, key, ownedKeys) => {
    if (!changed(sheet, values, column, key)) return
    const extra = config(values[column], sheet, row, EXCHANGE_HEADERS[sheet][column], ownedKeys)
    for (const k of Object.keys(extraConfig(target, ownedKeys))) delete target[k]
    Object.assign(target, extra)
  }
  const optional = (target, values, sheet, row, column, key, id, type) => {
    if (!changed(sheet, values, column, id)) return
    const value = values[column], parsed = type === 'number' ? numeric(value) : type === 'boolean' ? bool(value) : value
    if (type === 'number' && value !== '' && !Number.isFinite(parsed)) errors.push(issue(sheet, row, EXCHANGE_HEADERS[sheet][column], 'Use a numeric Excel cell or an ungrouped decimal such as 22.5 or 22,5. Ambiguous text 1,234/1.234 requires 1234 for an integer or 1.2340 for a decimal.'))
    if (type === 'boolean' && bool(value) == null) errors.push(issue(sheet, row, EXCHANGE_HEADERS[sheet][column], 'Use true, false or leave empty to inherit'))
    if (value === '') delete target[key]
    else target[key] = parsed
  }
  const instructions = workbook.getWorksheet('Instrucciones')
  instructions?.eachRow((line, row) => {
    if (line.getCell(1).value === 'Reglas del perfil (JSON)') { try { data.rules = config(scalar(line.getCell(2)), 'Instrucciones', row, 'Reglas del perfil (JSON)') } catch (error) { errors.push(issue('Instrucciones', row, 'Reglas del perfil (JSON)', error.message)) } }
    if (line.getCell(1).value === 'Preferencia de nombres') { const value = line.getCell(2).value; if (['aliases', 'original'].includes(value)) data.exerciseNameMode = value; else errors.push(issue('Instrucciones', row, 'Preferencia de nombres', 'Use aliases or original')) }
    if (line.getCell(1).value === 'Días de descanso (JSON)') {
      try {
        const rest = JSON.parse(scalar(line.getCell(2)))
        if (!obj(rest) || Object.keys(rest).some(key => !['week', 'dayPlan'].includes(key))) throw new Error()
        for (const field of ['week', 'dayPlan']) {
          if (rest[field] != null && (!Array.isArray(rest[field]) || rest[field].some(key => field === 'week' ? !days.includes(key) : !validDate(key)))) throw new Error()
          for (const key of rest[field] || []) data[field][key] = []
        }
      } catch { errors.push(issue('Instrucciones', row, 'Días de descanso (JSON)', 'Use {"week":[0,6],"dayPlan":["2026-10-08"]}; weekly days must be 0–6 and dates must be YYYY-MM-DD.')) }
    }
  })
  for (const { values: values, row } of sheetRows.Catálogo) {
    const [id, n, alias, custom, selector, libraryNote] = values
    for (const [value, field, required] of [[id, 'ID', true], [n, 'Nombre original', true], [alias, 'Apodo'], [selector, 'Selector', true], [libraryNote, 'Notas de biblioteca']]) text(value, 'Catálogo', row, field, required)
    const old = original?.data?.catalog?.find(ex => ex.id === id)
    const customValue = bool(custom)
    if (customValue == null) errors.push(issue('Catálogo', row, 'Personalizado', 'Use true or false'))
    data.catalog.push({ ...(old || {}), id, n, alias, aliasPresent: !!old?.aliasPresent || !!alias || !!old && old.alias !== alias, custom: customValue, selector, ...(old?.libraryNote != null || libraryNote ? { libraryNote } : {}) })
  }
  const selectors = new Map()
  data.catalog.forEach(ex => { const existing = selectors.get(ex.selector) || []; selectors.set(ex.selector, [...existing, ex.id]) })
  const routineMap = new Map(), assignments = []
  for (const { values: values, row } of sheetRows.Rutinas) {
    const [id, name, order, week, dates, note] = values
    text(id, 'Rutinas', row, 'ID', true); text(name, 'Rutinas', row, 'Nombre', true); text(note, 'Rutinas', row, 'Notas')
    const r = clone(originals.get(id) || { id: String(id), name: '', ex: [] }); r.ex = []
    mergeExtras(r, values, 'Rutinas', row, 11, id, routineColumnKeys)
    for (const [column, key, type] of [[6, 'prog'], [7, 'restSec', 'number'], [8, 'warmupRestSec', 'number'], [9, 'supersetMoveRestSec', 'number'], [10, 'supersetRoundRestSec', 'number']]) optional(r, values, 'Rutinas', row, column, key, id, type)
    r.name = String(name); if (changed('Rutinas', values, 5, id)) { if (note) r.note = String(note); else delete r.note }
    const position = numeric(order)
    if (!Number.isInteger(position) || position < 1) errors.push(issue('Rutinas', row, 'Orden', 'Order must be a positive integer'))
    if (routineMap.has(id)) errors.push(issue('Rutinas', row, 'ID', 'Duplicate routine ID'))
    routineMap.set(id, { r, position, row }); data.routines.push(r)
    for (const [field, value, title] of [['week', week, 'Semana (JSON)'], ['dayPlan', dates, 'Fechas (JSON)']]) {
      try { const schedule = JSON.parse(value || '{}'); if (!obj(schedule)) throw new Error(); for (const [key, order] of Object.entries(schedule)) { if (!Number.isInteger(order) || order < 0) throw new Error(); assignments.push({ field, key, id, order }) } } catch { errors.push(issue('Rutinas', row, title, 'Expected JSON object of day/date: nonnegative position')) }
    }
  }
  const byInstance = new Map()
  for (const { values: values, row } of sheetRows['Ejercicios de rutina']) {
    const [instance, rid, selector, order, sg, note, mode, side, repsPerSide, prog] = values, owner = routineMap.get(rid)
    for (const [value, field, required] of [[instance, 'Instancia', true], [rid, 'Rutina ID', true], [selector, 'Ejercicio (lista)', true], [sg, 'Superset'], [note, 'Notas'], [mode, 'Modo'], [prog, 'Progresión']]) text(value, 'Ejercicios de rutina', row, field, required)
    if (!owner) { errors.push(issue('Ejercicios de rutina', row, 'Rutina ID', 'Unknown routine reference')); continue }
    if (!instance || byInstance.has(instance)) { errors.push(issue('Ejercicios de rutina', row, 'Instancia', 'Instance must be unique and nonempty')); continue }
    const selected = selectors.get(selector)
    let selectedId = selected?.length === 1 ? selected[0] : null
    if (!selectedId) {
      if (!selector) { errors.push(issue('Ejercicios de rutina', row, 'Ejercicio (lista)', 'Choose an exercise from the catalog')); continue }
      // Retain unresolved/ambiguous text for an explicit in-app mapping, never pick by name.
      selectedId = `unresolved:${String(selector)}`
      if (!data.catalog.some(ex => ex.id === selectedId)) data.catalog.push({ id: selectedId, n: String(selector), custom: false })
    }
    const baseline = baselineExercises.get(instance), oldOwner = baseline && originals.get(baseline[1]), oldCfg = oldOwner?.ex?.[Number(baseline[3]) - 1]
    const e = clone(oldCfg || { id: selectedId }); e.id = selectedId
    mergeExtras(e, values, 'Ejercicios de rutina', row, 17, instance, exerciseColumnKeys)
    for (const [column, key, type] of [[10, 'inc', 'number'], [11, 'bodyweight', 'boolean'], [12, 'strictReps', 'boolean'], [13, 'amrap', 'boolean'], [14, 'supersetMoveRestSec', 'number'], [15, 'supersetRoundRestSec', 'number']]) optional(e, values, 'Ejercicios de rutina', row, column, key, instance, type)
    if (changed('Ejercicios de rutina', values, 16, instance)) { if (values[16] === '') delete e.intensifier; else e.intensifier = config(values[16], 'Ejercicios de rutina', row, 'Intensificador (JSON)') }
    for (const [col, key, value] of [[4, 'sg', sg], [5, 'note', note], [6, 'mode', mode], [7, 'side', bool(side)], [8, 'repsPerSide', bool(repsPerSide)], [9, 'prog', prog]]) if (changed('Ejercicios de rutina', values, col, instance)) { if (value === '' || value === false && ['side', 'repsPerSide'].includes(key)) delete e[key]; else e[key] = value }
    if (bool(side) == null || bool(repsPerSide) == null) errors.push(issue('Ejercicios de rutina', row, 'Por lado / Reps por lado', 'Use true or false'))
    const position = numeric(order)
    if (!Number.isInteger(position) || position < 1) errors.push(issue('Ejercicios de rutina', row, 'Orden', 'Order must be a positive integer'))
    byInstance.set(instance, { e, rid, position, row, series: [] }); owner.r.ex.push(e)
  }
  for (const record of sheetRows.Series) {
    const owner = byInstance.get(record.values[0])
    if (!owner) errors.push(issue('Series', record.row, 'Instancia', 'Unknown exercise instance'))
    else {
      for (const column of [1, 3, 4, 5, 7, 8, 9, 11, 14, 15, 16]) if (record.values[column] !== '') { const n = numeric(record.values[column]); if (Number.isFinite(n)) record.values[column] = n }
      if (record.values[13] !== '' && bool(record.values[13]) != null) record.values[13] = bool(record.values[13])
      owner.series.push(record)
    }
  }
  for (const [instance, owner] of byInstance) {
    const rows = owner.series.sort((a, b) => numeric(a.values[1]) - numeric(b.values[1])), e = owner.e
    const sourceExercise = data.catalog.find(ex => ex.id === e.id), definition = sourceExercise?.definition || builtins.get(e.id) || sourceExercise
    const mode = sourceMode(e, definition)
    const seen = new Set()
    rows.forEach(({ values, row }) => {
      const n = numeric(values[1]); if (!Number.isInteger(n) || n < 1 || seen.has(n)) errors.push(issue('Series', row, 'Orden', 'Series order must be positive and unique')); seen.add(n)
      if (values[6] !== unit) errors.push(issue('Series', row, 'Unidad', 'All weights must use the workbook unit'))
      if (!['Warm-up', 'Working', 'Top', 'Back-off'].includes(values[2])) errors.push(issue('Series', row, 'Tipo', 'Unknown set type'))
      for (const column of [3, 4, 5, 7, 8, 9, 11, 14, 15, 16]) if (values[column] !== '' && (!Number.isFinite(numeric(values[column])) || numeric(values[column]) < 0)) errors.push(issue('Series', row, EXCHANGE_HEADERS.Series[column], 'Use a nonnegative numeric Excel cell or an ungrouped decimal. Ambiguous text 1,234/1.234 requires 1234 for an integer or 1.2340 for a decimal.'))
      if (values[2] !== 'Back-off') for (const column of [10, 11, 12, 13]) if (values[column] !== '') errors.push(issue('Series', row, EXCHANGE_HEADERS.Series[column], 'This field only applies to Back-off series'))
      if (values[2] !== 'Warm-up') {
        const required = mode === 'reps' ? [3, 4] : mode === 'time' ? [14] : [15]
        for (const column of required) if (!(numeric(values[column]) > 0)) errors.push(issue('Series', row, EXCHANGE_HEADERS.Series[column], 'Positive prescription is required for this mode'))
        const excluded = mode === 'reps' ? [14, 15, 16] : mode === 'time' ? [3, 4, 7, 8, 15, 16] : [3, 4, 5, 7, 8, 14]
        for (const column of excluded) if (values[column] !== '') errors.push(issue('Series', row, EXCHANGE_HEADERS.Series[column], 'This target is unsupported for the selected exercise mode; leave it empty'))
      }
      if (values[2] === 'Back-off' && !(numeric(values[11]) >= 1 && numeric(values[11]) <= 50)) errors.push(issue('Series', row, 'Reducción (%)', 'Use a reduction between 1 and 50 percent'))
    })
    if (!rows.length) { errors.push(issue('Series', owner.row, 'Instancia', 'Exercise has no prescribed series')); continue }
    const baseline = (baselines.Series || []).filter(values => values[0] === instance)
    const oldExerciseRow = baselineExercises.get(instance)
    const baselineOwner = oldExerciseRow && originals.get(oldExerciseRow[1]), baselineCfg = baselineOwner?.ex?.[Number(oldExerciseRow?.[3]) - 1]
    if (equal(rows.map(record => record.values), baseline) && baselineCfg?.intensifier?.type === e.intensifier?.type && oldExerciseRow?.[6] === mode && oldExerciseRow?.[7] === !!e.side && oldExerciseRow?.[8] === !!e.repsPerSide) continue
    const groups = Object.fromEntries(['Warm-up', 'Working', 'Top', 'Back-off'].map(type => [type, rows.filter(record => record.values[2] === type)]))
    const baselineGroups = Object.fromEntries(Object.keys(groups).map(type => [type, baseline.filter(values => values[2] === type)]))
    const edited = (type, column) => !baselineGroups[type].length || !equal(groups[type][0]?.values[column], baselineGroups[type][0]?.[column])
    const setNumber = (key, value) => { if (value == null) delete e[key]; else e[key] = value }
    // The activation block is a warm-up in the execution model, not an ordinary
    // automatic warm-up. Keep ignored legacy set counts in preservation metadata.
    if (e.intensifier?.type === 'restpause' && (version === 2 || groups['Warm-up'].some(record => record.values[3] !== ''))) {
      if (mode !== 'reps' || rows.length !== 2 || groups['Warm-up'].length !== 1 || groups.Working.length !== 1 || rows[0].values[2] !== 'Warm-up') {
        errors.push(issue('Series', rows[0].row, 'Tipo', 'Rest-pause requires one activation Warm-up followed by one total-reps Working row. Remove additional rows; configure the technique in Intensificador (JSON).'))
        continue
      }
      for (const [type, key] of [['Warm-up', 'reps'], ['Working', 'totalReps']]) {
        const record = groups[type][0], values = record.values, reps = numeric(values[3])
        if (!Number.isInteger(reps) || reps < 1 || numeric(values[4]) !== reps) errors.push(issue('Series', record.row, 'Reps mín. / máx.', 'Rest-pause requires a positive fixed repetition target, with equal minimum and maximum.'))
        if (edited(type, 3) || edited(type, 4)) { if (type === 'Warm-up') e.reps = reps; else e.intensifier.totalReps = reps }
        if (edited(type, 9)) setNumber(type === 'Warm-up' ? 'warmupRestSec' : 'restSec', numeric(values[9]))
      }
      const activation = groups['Warm-up'][0], working = groups.Working[0]
      if ([7, 8, 14, 15, 16].some(column => activation.values[column] !== '')) errors.push(issue('Series', activation.row, 'Warm-up', 'Rest-pause activation has no RIR or time/cardio target; leave those fields empty.'))
      if (edited('Working', 5)) setNumber('weight', numeric(working.values[5]))
      if (edited('Warm-up', 5) && !equal(numeric(activation.values[5]), numeric(working.values[5]))) errors.push(issue('Series', activation.row, 'Peso', 'Rest-pause activation and Working share one load. Edit the Working load and retain the unchanged derived activation load.'))
      if (edited('Working', 7) || edited('Working', 8)) { setNumber('targetRirMin', numeric(working.values[7])); setNumber('targetRirMax', numeric(working.values[8])); delete e.targetRir }
      if (e.sets == null) e.sets = 1
      continue
    }
    const topback = groups.Top.length || groups['Back-off'].length
    if (topback && (groups.Working.length || !groups.Top.length || !groups['Back-off'].length)) errors.push(issue('Series', rows[0].row, 'Tipo', 'Use Working OR Top plus associated Back-off'))
    if (!topback && !groups.Working.length) errors.push(issue('Series', rows[0].row, 'Tipo', 'At least one Working series is required'))
    const types = rows.map(record => record.values[2]), sortedTypes = [...groups['Warm-up'], ...groups.Working, ...groups.Top, ...groups['Back-off']].map(record => record.values[2])
    if (!equal(types, sortedTypes)) errors.push(issue('Series', rows[0].row, 'Tipo', 'Order must be Warm-up, then Working or Top, then Back-off'))
    if (!baseline.length || baselineGroups['Warm-up'].length !== groups['Warm-up'].length) { if (groups['Warm-up'].length) e.warmupSets = groups['Warm-up'].length; else delete e.warmupSets }
    if (!baseline.length || baselineGroups.Working.length !== groups.Working.length || baselineGroups.Top.length !== groups.Top.length || baselineGroups['Back-off'].length !== groups['Back-off'].length) {
      e.sets = groups.Working.length || groups.Top.length + groups['Back-off'].length
      if (topback) { e.setScheme = 'topback'; e.topSets = groups.Top.length; e.backoffSets = groups['Back-off'].length }
      else { if (e.setScheme) e.setScheme = 'straight'; delete e.topSets; delete e.backoffSets }
    }
    for (const [type, group] of Object.entries(groups)) {
      if (!group.length) continue
      const first = group[0], v = first.values
      const sameCols = type === 'Warm-up' ? [3, 4, 5, 7, 8, 9, 14, 15, 16] : [3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
      for (const rec of group) for (const col of sameCols) if (!equal(v[col], rec.values[col])) errors.push(issue('Series', rec.row, EXCHANGE_HEADERS.Series[col], `TGym requires a shared ${type} prescription; independent values are unsupported`))
      if (type === 'Warm-up') {
        if ([3, 4, 5, 7, 8, 14, 15, 16].some(col => v[col] !== '')) errors.push(issue('Series', first.row, 'Warm-up', 'Warm-up reps, load, RIR and duration are automatic; leave them empty'))
        if (edited(type, 9)) setNumber('warmupRestSec', numeric(v[9]))
        continue
      }
      if (type === 'Back-off') {
        if (v[10] !== `${instance}:Top`) errors.push(issue('Series', first.row, 'Top asociado', 'Back-off must refer to this instance:Top'))
        if (edited(type, 11)) setNumber('backoffPct', numeric(v[11]))
        if (bool(v[13]) == null || v[13] === '') errors.push(issue('Series', first.row, 'Back-off automático', 'Use true or false'))
        else if (edited(type, 13)) e.autoBackoffReps = bool(v[13])
        if (v[12] === 'inherit') { if (edited(type, 12)) { delete e.backoffRepsOverride; delete e.backoffRepsMode; delete e.backoffRepOffset } }
        else if (['same', 'increased'].includes(v[12])) { if (edited(type, 12)) { e.backoffRepsOverride = true; e.backoffRepsMode = v[12]; delete e.backoffRepOffset } }
        else if (/^legacy:(?:[1-9]|10)$/.test(v[12])) { if (edited(type, 12)) { e.backoffRepsOverride = true; delete e.backoffRepsMode; e.backoffRepOffset = Number(v[12].slice(7)) } }
        else errors.push(issue('Series', first.row, 'Regla Back-off', 'Use inherit, same, increased or legacy:N with N between 1 and 10'))
      } else {
        if (edited(type, 5)) setNumber('weight', numeric(v[5]))
        if (edited(type, 9)) setNumber('restSec', numeric(v[9]))
      }
      if (mode === 'reps') {
        const min = numeric(v[3]), max = numeric(v[4])
        if (edited(type, 3) || edited(type, 4) || oldExerciseRow?.[6] !== mode) {
          if (type === 'Working') { e.repsMin = min; e.reps = max; e.repRange = min !== max }
          else if (type === 'Top') { e.topRepsMin = min; e.topRepsMax = max; e.repRange = min !== max; if (!e.reps) e.reps = max }
          else { e.backoffRepsMin = min; e.backoffRepsMax = max }
        }
        const prefix = type === 'Top' ? 'top' : type === 'Back-off' ? 'backoff' : 'target'
        if (edited(type, 7) || edited(type, 8)) {
          for (const [col, suffix] of [[7, 'RirMin'], [8, 'RirMax']]) setNumber(prefix + suffix, numeric(v[col]))
          delete e[`${prefix}Rir`]
        }
      } else if (mode === 'time') { if (edited(type, 14) || oldExerciseRow?.[6] !== mode) setNumber('sec', numeric(v[14])) }
      else { if (edited(type, 15) || oldExerciseRow?.[6] !== mode) setNumber('min', numeric(v[15])); if (edited(type, 16) || oldExerciseRow?.[6] !== mode) setNumber('speed', numeric(v[16])) }
    }
    if (topback && groups.Top.length && groups['Back-off'].length) {
      const back = groups['Back-off'][0], effective = effectiveBackoff(e, data.rules), expected = backoffWeightFor(e.weight, effective, loadingStepFor(e, unit, definition))
      if (edited('Back-off', 5) && (expected == null ? back.values[5] !== '' : numeric(back.values[5]) == null || Math.abs(numeric(back.values[5]) - expected) > 0.001)) errors.push(issue('Series', back.row, 'Peso', `Back-off load must follow Top reduction (${expected ?? 'empty'} ${unit}). Leave the unchanged derived value when editing Top.`))
      const expectedRest = restSeconds({ state: data.rules, routine: routineMap.get(owner.rid)?.r, target: e })
      if (edited('Back-off', 9) && back.values[9] !== '' && numeric(back.values[9]) !== expectedRest) errors.push(issue('Series', back.row, 'Descanso (s)', 'TGym shares rest between Top and Back-off'))
      if (e.autoBackoffReps !== false && (edited('Back-off', 3) || edited('Back-off', 4))) { const expectedReps = repBounds(effective, 'backoff'); if (numeric(back.values[3]) !== expectedReps.min || numeric(back.values[4]) !== expectedReps.max) errors.push(issue('Series', back.row, 'Reps mín. / máx.', 'Automatic Back-off bounds must agree with Top and the selected rule. Keep the unchanged derived values when editing Top.')) }
    }
  }
  for (const owner of routineMap.values()) {
    const instances = [...byInstance.values()].filter(record => record.rid === owner.r.id).sort((a, b) => a.position - b.position)
    if (new Set(instances.map(record => record.position)).size !== instances.length) errors.push(issue('Ejercicios de rutina', owner.row, 'Orden', 'Duplicate exercise order in routine'))
    owner.r.ex = instances.map(record => record.e)
  }
  if (new Set([...routineMap.values()].map(record => record.position)).size !== routineMap.size) errors.push(issue('Rutinas', 2, 'Orden', 'Duplicate routine order'))
  data.routines.sort((a, b) => routineMap.get(a.id).position - routineMap.get(b.id).position); data.routineOrder = data.routines.map(r => r.id)
  for (const field of ['week', 'dayPlan']) for (const key of new Set(assignments.filter(record => record.field === field).map(record => record.key))) {
    const slot = assignments.filter(record => record.field === field && record.key === key).sort((a, b) => a.order - b.order)
    if (key in data[field]) errors.push(issue('Rutinas', 2, field, `Day ${key} is marked as rest in Instrucciones and also assigned to a routine. Remove one of the conflicting entries.`))
    if (new Set(slot.map(record => record.order)).size !== slot.length) errors.push(issue('Rutinas', 2, field, `Duplicate schedule position: ${key}`))
    data[field][key] = slot.map(record => record.id)
  }
  // Empty rest-day markers survive an unchanged round trip, while visible assignments remain authoritative.
  if (original) for (const field of ['week', 'dayPlan']) for (const [key, ids] of Object.entries(original.data[field] || {})) if (!routineIds(ids).length && !(key in data[field])) data[field][key] = []
  const used = new Set(data.routines.flatMap(routine => routine.ex.map(ex => ex.id)))
  for (const ex of data.catalog) if (used.has(ex.id) && ex.custom && !obj(ex.definition)) {
    const row = sheetRows.Catálogo.find(record => record.values[0] === ex.id)?.row || 2
    const warning = issue('Catálogo', row, 'Definición personalizada', 'The full custom exercise definition and media are missing. Restore the _TGym sheet or export JSON from the source device. Visible catalogue names cannot reconstruct the exercise or its resources.')
    ;(version === 2 ? errors : warnings).push(warning)
  }
  // Diagnostic positions belong to this file read, never to the portable payload.
  const locations = { routines: new Map(), exercises: new Map(), catalog: new Map(), fields: new Map() }
  for (const [id, owner] of routineMap) {
    locations.routines.set(id, owner.row)
    const instances = [...byInstance.values()].filter(record => record.rid === id).sort((a, b) => a.position - b.position)
    instances.forEach((record, index) => {
      const key = `${id}:${index + 1}`, setField = (field, sheet, row, column) => locations.fields.set(`${key}:${field}`, { sheet, row, field: EXCHANGE_HEADERS[sheet][column] })
      locations.exercises.set(key, record.row)
      // Defaults identify extras in the editable JSON column, even when the core
      // validator uses a historical Series label for the corresponding field.
      for (const field of Object.keys(record.e)) setField(field, 'Ejercicios de rutina', record.row, 17)
      for (const [field, column] of Object.entries({ id: 2, sg: 4, Superset: 4, note: 5, Notas: 5, mode: 6, Modo: 6, side: 7, repsPerSide: 8, prog: 9, inc: 10, bodyweight: 11, strictReps: 12, amrap: 13, supersetMoveRestSec: 14, supersetRoundRestSec: 15, intensifier: 16, 'Drop count': 16, 'Drop %': 16, 'Rest-pause seconds': 16 })) setField(field, 'Ejercicios de rutina', record.row, column)
      const group = type => record.series.find(row => row.values[2] === type), work = group('Working') || group('Top'), warm = group('Warm-up'), top = group('Top'), back = group('Back-off')
      const seriesField = (field, target, column) => { if (target) setField(field, 'Series', target.row, column) }
      for (const [field, column] of Object.entries({ sets: 2, Tipo: 2, weight: 5, unit: 6, targetRir: 7, targetRirMin: 7, targetRirMax: 8, restSec: 9, sec: 14, min: 15, speed: 16 })) seriesField(field, work, column)
      for (const [field, column] of Object.entries({ reps: 4, repsMax: 4, repsMin: 3, repRange: 3 })) seriesField(field, record.e.intensifier?.type === 'restpause' ? warm : work, column)
      seriesField('Rest-pause reps', work, 4)
      seriesField('warmupSets', warm, 2); seriesField('Warm-up', warm, 2); seriesField('warmupRestSec', warm, 9)
      for (const [field, column] of Object.entries({ topSets: 2, topRepsMin: 3, topRepsMax: 4, topRir: 7, topRirMin: 7, topRirMax: 8 })) seriesField(field, top, column)
      for (const [field, column] of Object.entries({ backoffSets: 2, backoffRepsMin: 3, backoffRepsMax: 4, backoffRir: 7, backoffRirMin: 7, backoffRirMax: 8, backoffPct: 11, 'Reducción %': 11, backoffRepsMode: 12, 'Regla Back-off': 12, backoffRepsOverride: 12, backoffRepOffset: 12, autoBackoffReps: 13 })) seriesField(field, back, column)
      for (const [min, max] of [['repsMin', 'reps'], ['topRepsMin', 'topRepsMax'], ['backoffRepsMin', 'backoffRepsMax'], ['targetRirMin', 'targetRirMax'], ['topRirMin', 'topRirMax'], ['backoffRirMin', 'backoffRirMax']]) {
        const target = locations.fields.get(`${key}:${min}`), end = locations.fields.get(`${key}:${max}`)
        if (target && end) locations.fields.set(`${key}:${min} / ${max}`, { ...target, field: `${target.field} / ${end.field}` })
      }
    })
  }
  for (const record of sheetRows.Catálogo) if (!locations.catalog.has(record.values[0])) locations.catalog.set(record.values[0], record.row)
  return { data, errors, warnings, locations }
}

export async function readRoutineExchangeFile(file) {
  const invalid = (message, stage = 'select', cause) => Object.assign(new Error(message, cause ? { cause } : undefined), { kind: 'validation', stage })
  if (!file.size || file.size > ROUTINE_EXCHANGE_MAX_BYTES) throw invalid('Choose a nonempty file no larger than 15 MiB. Select fewer routines or split the transfer into separate files.')
  if (/\.xlsx$/i.test(file.name)) return parseRoutineWorkbook(await file.arrayBuffer())
  if (!/\.json$/i.test(file.name)) throw invalid('Choose a TGym .xlsx or .json file. PDF cannot be imported.')
  // Reading can fail for permissions or device access. Preserve that exception;
  // only a failed JSON parse proves the selected contents are malformed.
  const text = await file.text()
  try { return { data: JSON.parse(text.replace(/^\uFEFF/, '')), errors: [], warnings: [] } }
  catch (error) { throw invalid('The JSON file is damaged or incomplete. Export it again from TGym; do not rename another format to .json.', 'parse', error) }
}

export async function buildRoutineExchangeFile(S, ids, format, { signal, onProgress = () => {}, template = false } = {}) {
  aborted(signal); onProgress(5)
  const data = createRoutineExchange(S, template ? [] : ids, { fullCatalog: template })
  const name = `TGym-${template ? `routine-template-v${data.tgym_routine_exchange}` : 'routines'}-${todayISO()}.${format}`
  if (!template && !data.routines.length) throw new Error('Select at least one routine')
  let blob
  if (format === 'json') blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  else if (format === 'xlsx') { const workbook = await createRoutineWorkbook(data, { signal }); onProgress(65); const buffer = await workbook.xlsx.writeBuffer(); blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) }
  else if (format === 'pdf') {
    const { routinePDFFile } = await import('./routine-exchange-pdf.js'); return routinePDFFile(data, name, { signal, onProgress })
  } else throw new Error('Unsupported export format')
  if (blob.size > ROUTINE_EXCHANGE_MAX_BYTES) throw new Error('This transfer exceeds the 15 MiB import limit. Select fewer routines or split the transfer into separate files; keep all resources with their referenced routines.')
  aborted(signal); onProgress(100); return { blob, name }
}
