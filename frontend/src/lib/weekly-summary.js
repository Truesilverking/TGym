import { calculateWeeklyMuscleVolume } from './volume-targets.js'
import { personalRecords, recentRecords } from './personal-records.js'
import { isoOf } from './format.js'
import { loggedWorkouts } from './daily-plan.js'
import { nutritionTotals } from './nutrition-totals.js'
import { validDate } from './training-history.js'
import { LB_PER_KG } from './unit-conversion.js'

const dateOf = row => validDate(row.d) ? row.d : Number.isFinite(Number(row.start ?? row.t)) ? isoOf(new Date(Number(row.start ?? row.t))) : ''

/**
 * Builds a weekly recap card aggregating workouts, PRs, muscle volume, nutrition & weight
 */
export function buildWeeklySummary(state, anchorDate = new Date()) {
  const S = state || {}
  const d = typeof anchorDate === 'string' && validDate(anchorDate) ? new Date(anchorDate + 'T12:00:00') : new Date(anchorDate)
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
  const mondayIso = isoOf(monday)
  const sundayIso = isoOf(sunday)

  // 1. Workouts completed in this week
  const history = loggedWorkouts(S).map(w => ({ ...w, d: dateOf(w) })).filter(w => w.d && w.d <= sundayIso)
  const weekWorkouts = history.filter(w => dateOf(w) >= mondayIso)

  // 2. Personal records achieved this week
  // A later all-time record must not hide a record earned in this historical week.
  const allRecords = personalRecords({ ...S, workouts: history })
  const newPRs = recentRecords(allRecords, mondayIso).filter(r => String(r.recordDate) <= sundayIso)

  // 3. Muscle volume
  const muscleVolume = calculateWeeklyMuscleVolume(weekWorkouts, { weekStartMs: mondayMs, weekEndMs: sundayMs })

  // 4. Nutrition adherence
  const nutritionLogs = S.nutrition?.logs || {}
  const proteinGoal = Number.isFinite(Number(S.nutrition?.goals?.protein)) && Number(S.nutrition.goals.protein) > 0 ? Number(S.nutrition.goals.protein) : 140
  let daysLogged = 0
  let proteinHitDays = 0
  let totalCalories = 0

  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday)
    cur.setDate(monday.getDate() + i)
    const items = nutritionLogs[isoOf(cur)]?.items
    if (Array.isArray(items) && items.length) {
      daysLogged++
      const totals = nutritionTotals(items)
      const dayCals = totals.calories
      const dayProt = totals.protein
      totalCalories += dayCals
      if (dayProt >= proteinGoal * 0.9) {
        proteinHitDays++
      }
    }
  }

  // 5. Weight change
  const weekWeights = (S.bodyweight || []).filter(b => {
    const date = dateOf(b)
    return date && date >= mondayIso && date <= sundayIso && Number.isFinite(Number(b.w)) && Number(b.w) > 0
  }).sort((a, b) => dateOf(a).localeCompare(dateOf(b)) || (Number(a.t) || 0) - (Number(b.t) || 0))

  const profileUnit = S.unit === 'lb' ? 'lb' : 'kg'
  const toProfileWeight = b => {
    const rowUnit = b?.unit === 'lb' || b?.unit === 'kg' ? b.unit : profileUnit
    if (rowUnit === profileUnit) return Number(b.w)
    return rowUnit === 'lb' ? Number(b.w) / LB_PER_KG : Number(b.w) * LB_PER_KG
  }
  const weightDelta = weekWeights.length >= 2 ? Math.round((toProfileWeight(weekWeights[weekWeights.length - 1]) - toProfileWeight(weekWeights[0])) * 10) / 10 : null

  return {
    mondayIso,
    sundayIso,
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
