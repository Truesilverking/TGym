import { loadOfWorkouts } from './muscles.js'
import { loggedWorkouts } from './daily-plan.js'

export const DEFAULT_VOLUME_TARGETS = {
  min: 10, // MEV (Minimum Effective Volume)
  max: 20, // MRV (Maximum Recoverable Volume)
}

export const MUSCLE_GROUPS = [
  'chest', 'upper-back', 'quadriceps', 'hamstring', 'deltoids', 'biceps', 'triceps', 'calves', 'abs', 'gluteal'
]

/**
 * Calculates completed weekly hard sets per muscle and compares against target volume
 */
export function calculateWeeklyMuscleVolume(workouts = [], { weekStartMs = 0, weekEndMs = Date.now(), targets = {} } = {}) {
  const cutoff = weekStartMs > 0 ? weekStartMs : Date.now() - 7 * 86400000
  const sessions = loggedWorkouts({ workouts }).filter(w => {
    const timestamp = Number(w.start || new Date(w.d + 'T12:00:00').getTime())
    return Number.isFinite(timestamp) && timestamp >= cutoff && timestamp <= weekEndMs
  })
  // Reuse the map's weighted metadata and historical snapshots. Deleted/custom
  // exercises must retain their muscles, and secondary weights must not be guessed.
  const counts = loadOfWorkouts(sessions)

  const result = {}
  for (const slug of new Set([...Object.keys(counts), ...Object.keys(targets)])) {
    const rawSets = counts[slug] || 0
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
