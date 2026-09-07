// Resolve rest with the most specific value winning. A value of 0 explicitly disables the
// timer; only null/undefined falls through to the next level.
const first = (...values) => values.find(v => v !== undefined && v !== null)
const seconds = v => Math.max(0, Math.round(Number(v) || 0))

export function restSeconds({ state = {}, routine = {}, target = {}, setIndex = 0, warmup = false, phase = 'set' }) {
  const advanced = state.restAdvanced || {}
  let value
  // Moving to the next exercise uses the same rest selected between work sets. A separate
  // "after exercise" timer was harder to understand without adding useful control.
  if (phase === 'betweenExercises') value = first(target.restSec, routine.restSec, state.restSec)
  else if (phase === 'supersetMove') value = first(target.supersetMoveRestSec, routine.supersetMoveRestSec, advanced.supersetMove, 0)
  else if (phase === 'supersetRound') value = first(target.supersetRoundRestSec, routine.supersetRoundRestSec, advanced.supersetRound, routine.restSec, state.restSec)
  else if (warmup) value = first(target.warmupRestSec, routine.warmupRestSec, advanced.warmup, target.restSec, routine.restSec, state.restSec)
  else value = first(target.restSec, routine.restSec, state.restSec)
  return seconds(value)
}
