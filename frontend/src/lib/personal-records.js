// Personal records per exercise, read back from logged sessions. Pure: no store access.
//
//   bestWeight  heaviest completed working set (warm-ups excluded, see bestWeightForEntry)
//   best1RM     best estimated 1RM from a single completed set (see onerm.js: an estimate,
//               never a tested max, and only from sets inside the formula's rep cap)
//   recordDate  the most recent date either record was set — what "new PR" sorts on
import { bestSetOf, DEFAULT_FORMULA } from './onerm.js'
import { bestWeightForEntry } from './history.js'
import { loggedWorkouts } from './daily-plan.js'

export function personalRecords(S, { formula = DEFAULT_FORMULA } = {}) {
  const byExercise = new Map()
  for (const workout of loggedWorkouts(S)) {
    for (const entry of workout.entries || []) {
      const rec = byExercise.get(entry.id) || { id: entry.id, sessions: 0, bestWeight: null, best1RM: null, lastDate: null, entry }
      rec.sessions++
      if (!rec.lastDate || String(workout.d) > rec.lastDate) { rec.lastDate = workout.d; rec.entry = entry; rec.routineId = workout.routineId }
      const weight = bestWeightForEntry(entry)
      if (weight > 0 && (!rec.bestWeight || weight > rec.bestWeight.w)) rec.bestWeight = { w: weight, d: workout.d }
      const best = bestSetOf(entry, formula)
      if (best && (!rec.best1RM || best.est > rec.best1RM.est)) rec.best1RM = { ...best, d: workout.d }
      byExercise.set(entry.id, rec)
    }
  }
  return [...byExercise.values()]
    .filter(rec => rec.bestWeight || rec.best1RM)
    .map(rec => ({ ...rec, recordDate: [rec.bestWeight?.d, rec.best1RM?.d].filter(Boolean).sort().at(-1) }))
    .sort((a, b) => String(b.recordDate).localeCompare(String(a.recordDate)) || (b.best1RM?.est || b.bestWeight?.w || 0) - (a.best1RM?.est || a.bestWeight?.w || 0))
}

/** Records set on or after `sinceIso` (YYYY-MM-DD) — the "recent PRs" strip. */
export const recentRecords = (records, sinceIso) => records.filter(rec => String(rec.recordDate) >= sinceIso)
