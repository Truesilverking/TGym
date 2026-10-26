import { calculateWeeklyMuscleVolume } from './volume-targets.js'
import { personalRecords, recentRecords } from './personal-records.js'

/**
 * Builds a weekly recap card aggregating workouts, PRs, muscle volume, nutrition & weight
 */
export function buildWeeklySummary(state, anchorDate = new Date()) {
  const S = state || {}
  const d = new Date(anchorDate)
  // Find Monday of the current/target week
  const day = (d.getDay() + 6) % 7 // Monday = 0
  const monday = new Date(d)
  monday.setDate(d.getDate() - day)
  monday.setHours(0, 0, 0, 0)
  const mondayMs = monday.getTime()

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  const sundayMs = sunday.getTime()
  const mondayIso = monday.toISOString().slice(0, 10)
  const sundayIso = sunday.toISOString().slice(0, 10)

  // 1. Workouts completed in this week
  const weekWorkouts = (S.workouts || []).filter(w => {
    const t = Number(w.start || new Date(w.d).getTime())
    return Number.isFinite(t) && t >= mondayMs && t <= sundayMs
  })

  // 2. Personal records achieved this week
  const allRecords = personalRecords(S)
  const newPRs = recentRecords(allRecords, mondayIso).filter(r => String(r.recordDate) <= sundayIso)

  // 3. Muscle volume
  const muscleVolume = calculateWeeklyMuscleVolume(weekWorkouts, { weekStartMs: mondayMs })

  // 4. Nutrition adherence
  const nutritionLogs = S.nutrition?.logs || {}
  const proteinGoal = S.nutrition?.goals?.protein || 140
  let daysLogged = 0
  let proteinHitDays = 0
  let totalCalories = 0

  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday)
    cur.setDate(monday.getDate() + i)
    const iso = cur.toISOString().slice(0, 10)
    const log = nutritionLogs[iso]
    if (log?.items?.length) {
      daysLogged++
      const dayCals = log.items.reduce((sum, it) => sum + Math.round((it.calories || 0) * (it.qty || 1)), 0)
      const dayProt = log.items.reduce((sum, it) => sum + Math.round((it.protein || 0) * (it.qty || 1)), 0)
      totalCalories += dayCals
      if (dayProt >= proteinGoal * 0.9) {
        proteinHitDays++
      }
    }
  }

  // 5. Weight change
  const weekWeights = (S.bodyweight || []).filter(b => {
    const t = Number(b.t || new Date(b.d).getTime())
    return Number.isFinite(t) && t >= mondayMs && t <= sundayMs
  }).sort((a, b) => (a.t || new Date(a.d).getTime()) - (b.t || new Date(b.d).getTime()))

  const weightDelta = weekWeights.length >= 2 ? Math.round((weekWeights[weekWeights.length - 1].w - weekWeights[0].w) * 10) / 10 : null

  return {
    mondayIso: monday.toISOString().slice(0, 10),
    sundayIso: sunday.toISOString().slice(0, 10),
    workoutsCount: weekWorkouts.length,
    prsCount: newPRs.length,
    prs: newPRs,
    muscleVolume,
    nutrition: {
      daysLogged,
      avgCalories: daysLogged > 0 ? Math.round(totalCalories / daysLogged) : 0,
      proteinAdherencePct: daysLogged > 0 ? Math.round((proteinHitDays / daysLogged) * 100) : 0,
    },
    weightDelta,
  }
}
