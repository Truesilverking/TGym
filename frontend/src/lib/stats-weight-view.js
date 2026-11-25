import { weightUnit, weightConversionFactor } from './weight-units.js'

const record = value => value && typeof value === 'object' && !Array.isArray(value)
const numeric = value => (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') && Number.isFinite(Number(value))
// These are display projections, not a profile conversion. Keep full precision and
// retain the original object/array whenever none of its mass values need changing.
function changesFor(source) {
  let result = source
  return {
    put(key, value) {
      if (Object.is(result[key], value)) return
      if (result === source) result = {...source}
      result[key] = value
    },
    result: () => result,
  }
}
function mass(change, source, key, from, to) {
  if (from !== to && numeric(source[key])) change.put(key, Number(source[key]) * weightConversionFactor(from, to))
}
function stamp(change, source, key, to) {
  if (weightUnit(source[key], null) && source[key] !== to) change.put(key, to)
}
function records(rows, project) {
  if (!Array.isArray(rows)) return rows
  let result = rows
  for (let i=0;i<rows.length;i++) {
    const next = project(rows[i])
    if (next !== rows[i]) {
      if (result === rows) result = rows.slice()
      result[i] = next
    }
  }
  return result
}
function setView(set, inherited, to) {
  if (!record(set)) return set
  const from = weightUnit(set.unit, inherited), change = changesFor(set)
  mass(change,set,'w',from,to);stamp(change,set,'unit',to)
  if (Array.isArray(set.drops)) change.put('drops',records(set.drops,drop=>{
    if (!record(drop)) return drop
    const item=changesFor(drop),source=weightUnit(drop.unit,from)
    mass(item,drop,'w',source,to);stamp(item,drop,'unit',to)
    return item.result()
  }))
  return change.result()
}
function targetView(target, inherited, to, inheritedMode) {
  if (!record(target)) return target
  const from=weightUnit(target.unit,inherited),change=changesFor(target)
  for (const key of ['weight','topW','topWeight','loadingStep']) mass(change,target,key,from,to)
  if ((target.mode || inheritedMode) !== 'time') mass(change,target,'inc',from,to)
  stamp(change,target,'unit',to)
  return change.result()
}
function entryView(entry, inherited, to) {
  if (!record(entry)) return entry
  const from=weightUnit(entry.unit,inherited),change=changesFor(entry)
  for (const key of ['weight','topW','topWeight','loadingStep']) mass(change,entry,key,from,to)
  if ((entry.mode || entry.target?.mode) !== 'time') mass(change,entry,'inc',from,to)
  if (record(entry.target)) change.put('target',targetView(entry.target,from,to,entry.mode))
  if (Array.isArray(entry.sets)) change.put('sets',records(entry.sets,set=>setView(set,from,to)))
  stamp(change,entry,'unit',to)
  return change.result()
}
function workoutView(workout, inherited, to) {
  if (!record(workout)) return workout
  const from=weightUnit(workout.unit,inherited),change=changesFor(workout)
  mass(change,workout,'vol',from,to)
  mass(change,workout,'bw',weightUnit(workout.bwUnit,weightUnit(workout.bodyweightUnit,from)),to)
  mass(change,workout,'bodyweight',weightUnit(workout.bodyweightUnit,weightUnit(workout.bwUnit,from)),to)
  for (const key of ['unit','bwUnit','bodyweightUnit']) stamp(change,workout,key,to)
  if (Array.isArray(workout.entries)) change.put('entries',records(workout.entries,entry=>entryView(entry,from,to)))
  return change.result()
}
function bodyweightView(row, inherited, to) {
  if (!record(row)) return row
  const from=weightUnit(row.unit,inherited),change=changesFor(row)
  mass(change,row,'w',from,to);stamp(change,row,'unit',to)
  if (Array.isArray(row.samples)) change.put('samples',records(row.samples,sample=>bodyweightView(sample,from,to)))
  return change.result()
}

// Stats calculates and labels in the profile's display unit. Historical stamps
// remain authoritative; neither the source profile nor its records are mutated.
// Other record families, live sessions and editing/export inputs remain raw.
export function statsWeightView(state) {
  if (!record(state)) return state
  const unit=weightUnit(state.unit,'kg'),change=changesFor(state)
  if (Array.isArray(state.workouts)) change.put('workouts',records(state.workouts,workout=>workoutView(workout,unit,unit)))
  if (Array.isArray(state.bodyweight)) change.put('bodyweight',records(state.bodyweight,row=>bodyweightView(row,unit,unit)))
  return change.result()
}
