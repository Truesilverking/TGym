import { MEASURE_FIELDS } from './stats-insights.js'

export const LB_PER_KG = 2.2046226218487757
export const CM_PER_IN = 2.54

const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
const rounded = (value, factor) => Math.round(Number(value) * factor * 100) / 100
const change = (object, key, factor) => {
  if (object && finite(object[key])) object[key] = rounded(object[key], factor)
}

function convertSet(set, factor, unit) {
  change(set, 'w', factor)
  if (Array.isArray(set?.drops)) set.drops.forEach(drop => change(drop, 'w', factor))
  if (set?.unit) set.unit = unit
}

function convertEntry(entry, factor, unit) {
  change(entry, 'topW', factor)
  change(entry, 'topWeight', factor)
  change(entry, 'weight', factor)
  change(entry, 'inc', factor)
  change(entry?.target, 'weight', factor)
  change(entry?.target, 'inc', factor)
  if (entry?.target?.unit) entry.target.unit = unit
  // A saved workout contains an array of performed sets, while a routine contains the
  // prescribed set count as a number (`sets: 4`). Both pass through this function.
  if (Array.isArray(entry?.sets)) entry.sets.forEach(set => convertSet(set, factor, unit))
  if (entry?.unit) entry.unit = unit
}

function convertSession(session, factor, unit) {
  if (!session) return
  change(session, 'bw', factor)
  change(session, 'bodyweight', factor)
  change(session, 'vol', factor)
  if (Array.isArray(session.entries)) session.entries.forEach(entry => convertEntry(entry, factor, unit))
  session.unit = unit
  if (session.bwUnit) session.bwUnit = unit
  if (session.bodyweightUnit) session.bodyweightUnit = unit
}

export const weightStepFor = unit => unit === 'lb' ? 5 : 2.5

/** Convert every stored load as one state mutation. The unit stamps move with the
 * values, so recovery/statistics never interpret a converted number as its old unit. */
export function convertWeightState(state, nextUnit) {
  const previous = state.unit === 'lb' ? 'lb' : 'kg'
  const next = nextUnit === 'lb' ? 'lb' : 'kg'
  if (previous === next) return state
  const factor = next === 'lb' ? LB_PER_KG : 1 / LB_PER_KG

  change(state, 'targetW', factor)
  ;(Array.isArray(state.bodyweight) ? state.bodyweight : []).forEach(row => {
    change(row, 'w', factor)
    if (Array.isArray(row.samples)) row.samples.forEach(sample => change(sample, 'w', factor))
  })
  Object.values(state.exWeights || {}).forEach(row => change(row, 'w', factor))
  Object.values(state.exerciseGoals || {}).forEach(goal => change(goal, 'weight', factor))
  ;(Array.isArray(state.routines) ? state.routines : []).forEach(routine => {
    if (Array.isArray(routine.ex)) routine.ex.forEach(entry => convertEntry(entry, factor, next))
  })
  ;(Array.isArray(state.workouts) ? state.workouts : []).forEach(workout => convertSession(workout, factor, next))
  convertSession(state.active, factor, next)
  state.unit = next
  return state
}

/** Height and tape measurements use the same display unit selected in Settings.
 * The legacy `heightCm` key is retained for backup compatibility, but its value is
 * interpreted using `measurementUnit` throughout the app. */
export function convertMeasurementState(state, nextUnit) {
  const previous = state.measurementUnit === 'in' ? 'in' : 'cm'
  const next = nextUnit === 'in' ? 'in' : 'cm'
  if (previous === next) return state
  const factor = next === 'in' ? 1 / CM_PER_IN : CM_PER_IN

  change(state, 'heightCm', factor)
  const keys = new Set(MEASURE_FIELDS.map(([key]) => key))
  // Old backups used one arm/thigh/calf value; keep those compatible too.
  ;['arm', 'thigh', 'calf'].forEach(key => keys.add(key))
  ;(Array.isArray(state.measurements) ? state.measurements : []).forEach(row => keys.forEach(key => change(row, key, factor)))
  state.measurementUnit = next
  return state
}
