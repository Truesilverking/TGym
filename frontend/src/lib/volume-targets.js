import { musclesOf } from './muscles.js'
import { EXIDX, exOr } from './exercises.js'
import { isWarmupRow } from './workout-model.js'

export const DEFAULT_VOLUME_TARGETS = {
  min: 10, // MEV (Minimum Effective Volume)
  max: 20, // MRV (Maximum Recoverable Volume)
}

export const MUSCLE_GROUPS = [
  'chest', 'back', 'quads', 'hamstrings', 'shoulders', 'biceps', 'triceps', 'calves', 'abs', 'glutes'
]

/**
 * Calculates completed weekly hard sets per muscle and compares against target volume
 */
export function calculateWeeklyMuscleVolume(workouts = [], { weekStartMs = 0, targets = {} } = {}) {
  const cutoff = weekStartMs > 0 ? weekStartMs : Date.now() - 7 * 86400000
  const counts = {}

  for (const w of workouts) {
    const timestamp = Number(w.start || new Date(w.d).getTime())
    if (!Number.isFinite(timestamp) || timestamp < cutoff) continue

    for (const entry of w.entries || []) {
      const hardSets = (entry.sets || []).filter(s => s.done && !isWarmupRow(s)).length
      if (hardSets === 0) continue

      const ex = EXIDX[entry.id] || exOr(entry.id)
      const muscles = musclesOf(ex)

      for (const [slug, weight] of Object.entries(muscles)) {
        // Direct / primary muscles get full count; secondary get fractional contribution (0.5)
        const contribution = (Number(weight) || 1) >= 0.8 ? hardSets : hardSets * 0.5
        counts[slug] = (counts[slug] || 0) + contribution
      }
    }
  }

  const result = {}
  for (const [slug, rawSets] of Object.entries(counts)) {
    const sets = Math.round(rawSets * 10) / 10
    const muscleTarget = targets[slug] || DEFAULT_VOLUME_TARGETS
    const min = muscleTarget.min ?? DEFAULT_VOLUME_TARGETS.min
    const max = muscleTarget.max ?? DEFAULT_VOLUME_TARGETS.max

    let status = 'optimal'
    if (sets < min) status = 'low'
    else if (sets > max) status = 'high'

    result[slug] = {
      muscle: slug,
      sets,
      min,
      max,
      status,
      ratio: Math.round((sets / Math.max(1, min)) * 100),
    }
  }

  return result
}
