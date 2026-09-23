import { trackingStart, trainingStart } from './training-history.js'
import { effectiveRoutineId } from './history.js'
import { isoOf } from './format.js'

const safeState = S => ({ ...S, routines: S.routines || [], week: S.week || {}, dayPlan: S.dayPlan || {} })
export const loggedWorkouts = S => {
  const seen = new Set()
  return (S.workouts || []).filter(w => {
    if (!w || w.active || (w.id != null && w.id === S.active?.id) || w.cancelled || w.canceled || ['active', 'cancelled', 'canceled'].includes(w.status) || ['cancelled', 'canceled'].includes(w.finishReason)) return false
    if (w.id == null) return true // Legacy rows without IDs can be distinct sessions.
    if (seen.has(w.id)) return false
    seen.add(w.id)
    return true
  })
}
export function matchesScheduled(workout, routineId, routines) {
  return workout.routineId === routineId || (!workout.routineId && routines.some(r => r.id === routineId && r.name === workout.name))
}
export function consistencyDays(S, start, end, now = new Date()) {
  const state = safeState(S), today = isoOf(now), byDay = {}
  for (const w of loggedWorkouts(S)) (byDay[w.d] ||= []).push(w)
  const tracking = trackingStart(S,today)
  const days = []
  for (const d = new Date(start + 'T12:00:00'); isoOf(d) <= end; d.setDate(d.getDate() + 1)) {
    const iso = isoOf(d)
    if (iso < tracking) { days.push({ iso, routineId:null, planned:false, workouts:[], extra:0, status:'untracked' }); continue }
    const routineId = S.scheduleStarted && iso < S.scheduleStarted ? null : effectiveRoutineId(state, iso)
    const planned = !!routineId && state.routines.some(r => r.id === routineId)
    const workouts = byDay[iso] || []
    const matched = planned && workouts.some(w => matchesScheduled(w, routineId, state.routines))
    const extra = workouts.filter(w => !planned || !matchesScheduled(w, routineId, state.routines)).length
    days.push({ iso, routineId, planned, workouts, extra, status: matched ? 'completed' : planned ? (iso < today ? 'missed' : 'pending') : 'rest' })
  }
  return days
}
export function consistencyStats(S, start, end, now = new Date()) {
  const days = consistencyDays(S, start, end, now)
  const result = { planned: 0, completed: 0, missed: 0, pending: 0, extra: 0 }
  for (const day of days) {
    if (day.planned) result.planned++
    if (day.status !== 'rest' && day.status !== 'untracked') result[day.status]++
    result.extra += day.extra
  }
  const evaluated = result.completed + result.missed
  return { ...result, rate: evaluated ? result.completed / evaluated : null }
}
export function nextScheduledWorkout(S, now = new Date()) {
  const state = safeState(S), today = isoOf(now), workouts = loggedWorkouts(S)
  // After the last override/logged future session, one full week covers recurrence.
  const dates = [today, S.scheduleStarted, ...Object.keys(state.dayPlan), ...(S.trainingPauses || []).map(p=>p.end), ...workouts.map(w => w.d)].filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d || '')).sort()
  const end = new Date(dates.at(-1) + 'T12:00:00'); end.setDate(end.getDate() + 7)
  for (const d = new Date(today + 'T12:00:00'); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = isoOf(d)
    if (iso < trainingStart(S, today) || S.scheduleStarted && iso < S.scheduleStarted) continue
    const id = effectiveRoutineId(state, iso)
    if (id && state.routines.some(r => r.id === id) && !workouts.some(w => w.d === iso && matchesScheduled(w, id, state.routines))) return iso
  }
  return null
}
