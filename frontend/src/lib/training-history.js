import { routineIds } from './daily-plan.js'
import { dayNumber } from './training-pause.js'
import { todayISO } from './format.js'

const recordedWorkout = (w,S) => w && !w.active && !(w.id != null && w.id === S.active?.id) && !w.cancelled && !w.canceled && !['active','cancelled','canceled'].includes(w.status) && !['cancelled','canceled'].includes(w.finishReason)
export const validDate = value => Number.isFinite(dayNumber(value))
export function trainingStart(S, today = todayISO()) {
  if (validDate(S.trainingStartDate)) return S.trainingStartDate
  return (S.workouts || []).filter(w => recordedWorkout(w,S) && validDate(w.d)).map(w => w.d).sort()[0] || (validDate(S.scheduleStarted) ? S.scheduleStarted : today)
}
// Estimates describe undated sessions before tracking. They never populate the calendar.
export function trackingStart(S, today = todayISO()) {
  const start = trainingStart(S, today)
  const recorded = (S.workouts || []).filter(w => recordedWorkout(w,S) && validDate(w.d) && w.d >= start).map(w => w.d).sort()[0]
  const boundary = [S.trainingHistory?.trackedFrom || (S.trainingStartDate ? start : S.scheduleStarted), recorded].filter(validDate).sort()[0] || start
  return [start, boundary].filter(validDate).sort().at(-1)
}
export const isUntracked = (S, date, today) => date < trackingStart(S, today)
export function statisticsState(S, today = todayISO()) {
  const start = trainingStart(S, today), seen = new Set()
  const workouts = (S.workouts || []).filter(w => {
    if (!recordedWorkout(w,S) || !validDate(w.d) || w.d < start || w.d > today) return false
    if (w.id != null && seen.has(w.id)) return false
    if (w.id != null) seen.add(w.id)
    return true
  })
  const result = { ...S, workouts }
  for (const key of ['bodyweight','measurements','inbody']) result[key] = (S[key] || []).filter(row => row.d >= start && row.d <= today)
  return result
}
export function historySummary(S, today = todayISO()) {
  const start = trainingStart(S, today), trackedWorkouts = statisticsState(S, today).workouts.length
  const historicalWorkouts = Math.max(0, Math.trunc(Number(S.trainingHistory?.historicalWorkouts) || 0))
  const total = trackedWorkouts + historicalWorkouts
  const weeks = Math.max(1, dayNumber(today) - dayNumber(start) + 1) / 7
  const scheduledPerWeek = Object.values(S.week || {}).flatMap(routineIds).filter(id => (S.routines || []).some(r => r.id === id)).length
  return { start, trackedWorkouts, historicalWorkouts, total, averagePerWeek: total / weeks, scheduledPerWeek }
}
export function validateTrainingHistory(start, history, today = todayISO()) {
  return validDate(start) && start <= today && validDate(history?.trackedFrom) && history.trackedFrom <= today &&
    Number.isSafeInteger(history.historicalWorkouts) && history.historicalWorkouts >= 0 && history.historicalWorkouts <= 1000000 &&
    Number.isFinite(history.workoutsPerWeek) && history.workoutsPerWeek >= 0 && history.workoutsPerWeek <= 50 &&
    (!history.historicalWorkouts || start < history.trackedFrom)
}
