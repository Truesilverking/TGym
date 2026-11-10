import { MEASURE_FIELDS } from './stats-insights.js'
import { LB_PER_KG, weightUnit, weightConversionFactor as conversionFactor } from './weight-units.js'

export { LB_PER_KG } from './weight-units.js'
export const CM_PER_IN = 2.54

const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
const rounded = (value, factor) => Math.round(Number(value) * factor * 100) / 100
const change = (object, key, factor) => {
  if (factor !== 1 && object && finite(object[key])) object[key] = rounded(object[key], factor)
}
const stampUnit = (object, unit) => {
  // Legacy mode units such as seconds/minutes are not weight stamps.
  if (object && (object.unit === 'kg' || object.unit === 'lb')) object.unit = unit
}

function convertSet(set, previous, unit) {
  const source = weightUnit(set?.unit, previous), factor = conversionFactor(source, unit)
  change(set, 'w', factor)
  if (Array.isArray(set?.drops)) set.drops.forEach(drop => {
    change(drop, 'w', conversionFactor(weightUnit(drop?.unit, source), unit))
    stampUnit(drop, unit)
  })
  stampUnit(set, unit)
}

function convertEntry(entry, previous, unit) {
  const source = weightUnit(entry?.unit, previous), factor = conversionFactor(source, unit)
  const targetSource = weightUnit(entry?.target?.unit, source), targetFactor = conversionFactor(targetSource, unit)
  change(entry, 'topW', factor)
  change(entry, 'topWeight', factor)
  change(entry, 'weight', factor)
  if ((entry?.mode || entry?.target?.mode) !== 'time') change(entry, 'inc', factor)
  change(entry?.target, 'weight', targetFactor)
  if ((entry?.target?.mode || entry?.mode) !== 'time') change(entry?.target, 'inc', targetFactor)
  // Loading grids are weights even for timed holds; preserve their precision across units.
  for (const [cfg, cfgFactor] of [[entry, factor], [entry?.target, targetFactor]]) if (cfgFactor !== 1 && cfg && finite(cfg.loadingStep)) cfg.loadingStep = Math.round(Number(cfg.loadingStep) * cfgFactor * 1e6) / 1e6
  stampUnit(entry?.target, unit)
  // A saved workout contains an array of performed sets, while a routine contains the
  // prescribed set count as a number (`sets: 4`). Both pass through this function.
  if (Array.isArray(entry?.sets)) entry.sets.forEach(set => convertSet(set, source, unit))
  stampUnit(entry, unit)
}

function convertSession(session, previous, unit, includeResume = true) {
  if (!session) return
  const source = weightUnit(session.unit, previous), factor = conversionFactor(source, unit)
  if (includeResume && session.resumeSnapshot) convertSession(session.resumeSnapshot, source, unit, false)
  change(session, 'bw', conversionFactor(weightUnit(session.bwUnit, weightUnit(session.bodyweightUnit, source)), unit))
  change(session, 'bodyweight', conversionFactor(weightUnit(session.bodyweightUnit, weightUnit(session.bwUnit, source)), unit))
  change(session, 'vol', factor)
  if (Array.isArray(session.entries)) session.entries.forEach(entry => convertEntry(entry, source, unit))
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
    const source=row.unit==='lb'||row.unit==='kg'?row.unit:previous
    const rowFactor=source===next?1:next==='lb'?LB_PER_KG:1/LB_PER_KG
    change(row, 'w', rowFactor)
    if (Array.isArray(row.samples)) row.samples.forEach(sample => {
      change(sample, 'w', conversionFactor(weightUnit(sample?.unit, source), next))
      stampUnit(sample, next)
    })
    if (row.unit) row.unit=next
  })
  Object.values(state.exWeights || {}).forEach(row => change(row, 'w', factor))
  Object.values(state.exerciseGoals || {}).forEach(goal => change(goal, 'weight', factor))
  ;(Array.isArray(state.routines) ? state.routines : []).forEach(routine => {
    if (Array.isArray(routine.ex)) routine.ex.forEach(entry => convertEntry(entry, previous, next))
  })
  ;(Array.isArray(state.workouts) ? state.workouts : []).forEach(workout => convertSession(workout, previous, next))
  convertSession(state.active, previous, next)
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
  ;(Array.isArray(state.measurements) ? state.measurements : []).forEach(row => {
    const source = row.unit === 'in' || row.unit === 'cm' ? row.unit : previous
    const rowFactor = source === next ? 1 : next === 'in' ? 1 / CM_PER_IN : CM_PER_IN
    keys.forEach(key => change(row, key, rowFactor))
    if (row.unit) row.unit = next
  })
  state.measurementUnit = next
  return state
}
