import { mergeTGymStates } from './state-merge.js'
import { convertMeasurementState, convertWeightState } from './unit-conversion.js'

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const object = value => value && typeof value === 'object' && !Array.isArray(value)
const preferences = new Set(['unit','measurementUnit','restSec','restPauseSec','restAdvanced','sound','vibration','reduceMotion','keepAwake','lang','sounds','soundVolume','soundMuted','theme','accent','body','targetW','measurementReminders','reminder','effort','strictReps','backoffRepsMode','exerciseNameMode','statsSections','deload','autoBackup','gifSize','cloudSync','activeEquipId','equipFilterOn','hasCompletedOnboarding','hasCompletedAppTour','healthConnection'])
const ambiguous = () => new Error('Local data changed. Please synchronize again.')

// Only the edits made to an empty API profile are rebased. The remote profile is
// the complete baseline, never an empty local snapshot selected by freshness.
export function rebaseEmptyApiProfile(before, current, remote, defaults) {
  const next = Object.assign(structuredClone(defaults), structuredClone(remote))
  const base = structuredClone(before), local = structuredClone(current)
  const unit = current.unit !== before.unit ? current.unit : next.unit
  const measurementUnit = current.measurementUnit !== before.measurementUnit ? current.measurementUnit : next.measurementUnit
  for (const profile of [next, base, local]) {
    convertWeightState(profile, unit)
    convertMeasurementState(profile, measurementUnit)
  }
  const edited = (target, prior, value) => {
    if (same(prior, value)) return target
    if (object(prior) && object(value)) {
      const result = object(target) ? structuredClone(target) : {}
      for (const key of new Set([...Object.keys(prior), ...Object.keys(value)])) {
        if (same(prior[key], value[key])) continue
        if (value[key] === undefined) delete result[key]
        else result[key] = edited(result[key], prior[key], value[key])
      }
      return result
    }
    return structuredClone(value)
  }
  for (const key of new Set([...Object.keys(base), ...Object.keys(local)])) {
    if (['_ts','storageVersion','active','unit','measurementUnit'].includes(key) || same(base[key], local[key])) continue
    if (preferences.has(key)) next[key] = edited(next[key], base[key], local[key])
    else {
      // Existing identity-based merging retains new records from both copies.
      // Conflicting snapshots/deletions require review rather than a destructive PUT.
      if (Array.isArray(base[key]) && Array.isArray(local[key]) && base[key].some(row => !local[key].some(value => same(row, value)))) throw ambiguous()
      const { merged, conflicts } = mergeTGymStates({[key]:local[key]}, {[key]:next[key]})
      if (conflicts.length) throw ambiguous()
      next[key] = merged[key]
    }
  }
  if (local.active) next.active = local.active
  return next
}
