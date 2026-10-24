// Pure persisted-session rules shared with web, mobile and the read-only MCP.
export const startSessionOrigin = routineId => ({ type: routineId ? 'planned' : 'extra', routineId: routineId || null })
export function sessionOrigin(workout, routines = []) {
  if (['planned', 'extra'].includes(workout?.sessionOrigin?.type)) return workout.sessionOrigin
  if (workout?.routineId) return startSessionOrigin(workout.routineId)
  const matches = routines.filter(r => r.name === workout?.name)
  return startSessionOrigin(matches.length === 1 ? matches[0].id : null)
}
const positive = value => value !== true && Number.isFinite(Number(value)) && Number(value) > 0
const explicitMode = row => {
  const mode=String(row?.mode || '').trim().toLowerCase(),unit=String(row?.unit || '').trim().toLowerCase()
  if (['reps','time','cardio'].includes(mode)) return mode
  if (['rep','reps','repetition','repetitions'].includes(unit)) return 'reps'
  if (['sec','secs','second','seconds'].includes(unit)) return 'time'
  if (['min','mins','minute','minutes'].includes(unit)) return 'cardio'
  return null
}
const inferredMode = row => explicitMode(row) || (String(row?.mode || '').trim().toLowerCase()==='amrap' ? 'reps' : row?.min!=null || row?.speed!=null ? 'cardio' : row?.sec!=null || row?.seconds!=null || row?.durationSec!=null ? 'time' : row?.r!=null || row?.reps!=null || row?.actualReps!=null ? 'reps' : null)
// The API ships without the frontend. Web supplies its existing row resolvers;
// standalone defaults preserve the same legacy modes and phases.
const modeOf = (row,target) => explicitMode(row) || inferredMode(target) || inferredMode(row) || 'reps'
const warmupOf = row => row?.phase != null && row.phase !== '' ? ['warmup','warm-up','warm_up'].includes(String(row.phase).trim().toLowerCase()) : row?.warmup === true
export function hasWorkoutActivity(workout, { modeForSet=modeOf, isWarmupRow=warmupOf } = {}) {
  return (workout?.entries || []).some(entry => (entry.sets || []).some(set => {
    if (isWarmupRow(set) || !(set.done || set.leftDone || set.rightDone)) return false
    const mode = modeForSet(set, entry.target || {})
    if (mode === 'time') return positive(set.sec ?? set.seconds ?? set.durationSec) || !!set.leftDone && positive(set.leftSec) || !!set.rightDone && positive(set.rightSec)
    if (mode === 'cardio') return positive(set.min) || positive(set.sec)
    return positive(set.r ?? set.reps ?? set.actualReps)
  }))
}
