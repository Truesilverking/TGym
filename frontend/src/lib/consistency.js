import { dailyPlan, loggedWorkouts } from './daily-plan.js'
export { loggedWorkouts, matchesScheduled } from './daily-plan.js'
import { trackingStart, trainingStart } from './training-history.js'
import { effectiveRoutineId } from './history.js'
import { isoOf } from './format.js'

const safeState = S => ({ ...S, routines: S.routines || [], week: S.week || {}, dayPlan: S.dayPlan || {} })
export function consistencyDays(S, start, end, now = new Date()) {
  const state = safeState(S), today = isoOf(now), byDay = {}
  for (const w of loggedWorkouts(S)) (byDay[w.d] ||= []).push(w)
  const tracking = trackingStart(S,today)
  const days = []
  for (const d = new Date(start + 'T12:00:00'); isoOf(d) <= end; d.setDate(d.getDate() + 1)) {
    const iso = isoOf(d)
    if (iso < tracking) { days.push({ iso, routineId:null, planned:false, workouts:[], extra:0, status:'untracked' }); continue }
    const plan = dailyPlan(state,iso)
    const routineId = S.scheduleStarted && iso < S.scheduleStarted ? null : effectiveRoutineId(state, iso)
    const planned = plan.total > 0
    const workouts = byDay[iso] || []
    const missed = plan.skipped + (iso < today ? plan.pending.length : 0)
    days.push({ iso, routineId, planned, workouts, extra:plan.extra, plan,
      status: planned ? plan.completed === plan.total ? 'completed' : iso < today || plan.skipped === plan.total ? 'missed' : 'pending' : 'rest',
      counts:{planned:plan.total,completed:plan.completed,missed,pending:iso < today ? 0 : plan.pending.length} })
  }
  return days
}
export function consistencyStats(S, start, end, now = new Date()) {
  const days = consistencyDays(S, start, end, now)
  const result = { planned: 0, completed: 0, missed: 0, pending: 0, extra: 0 }
  for (const day of days) {
    for (const key of ['planned','completed','missed','pending']) result[key] += day.counts?.[key] || 0
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
    if (dailyPlan(state,iso).pending.length) return iso
  }
  return null
}
