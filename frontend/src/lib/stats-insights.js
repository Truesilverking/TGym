import { effectiveRoutineId } from './history.js'
import { isoOf } from './format.js'
import { workoutElapsedMs } from './workout-time.js'

export const KG_PER_LB = 0.45359237
export const MEASURE_FIELDS = [
  ['neck', 'Neck'], ['shoulders', 'Shoulders'], ['chest', 'Chest'], ['waist', 'Waist'], ['hips', 'Hips'],
  ['armLeft', 'Left upper arm'], ['armRight', 'Right upper arm'], ['forearmLeft', 'Left forearm'], ['forearmRight', 'Right forearm'],
  ['thighLeft', 'Left thigh'], ['thighRight', 'Right thigh'], ['calfLeft', 'Left calf'], ['calfRight', 'Right calf'],
]
const LEGACY_MEASURE = { armLeft: 'arm', armRight: 'arm', thighLeft: 'thigh', thighRight: 'thigh', calfLeft: 'calf', calfRight: 'calf' }
export const measurementValue = (row, key) => Number(row?.[key] ?? row?.[LEGACY_MEASURE[key]]) || 0

export function bmiFor(weight, unit, height, measurementUnit = 'cm') {
  const h = Number(height) * (measurementUnit === 'in' ? 0.0254 : 0.01)
  const w = Number(weight) * (unit === 'lb' ? KG_PER_LB : 1)
  if (!(h > 0) || !(w > 0)) return null
  return Math.round((w / (h * h)) * 10) / 10
}

export function bmiBand(value) {
  if (!(value > 0)) return null
  if (value < 18.5) return 'Underweight'
  if (value < 25) return 'Healthy range'
  if (value < 30) return 'Overweight'
  return 'Obesity range'
}

export function validTimedSessions(workouts) {
  return (workouts || []).filter(w => {
    const ms = workoutElapsedMs(w)
    // Very long sessions almost always mean an old session was left running. Keep them in
    // history, but do not let one forgotten timer ruin averages and the duration chart.
    return Number.isFinite(ms) && ms >= 60000 && ms <= 12 * 3600000
  }).map(w => ({ ...w, durationMs: workoutElapsedMs(w) }))
}

export function sessionTimingSummary(workouts) {
  const sessions = validTimedSessions(workouts).sort((a, b) => a.start - b.start)
  if (!sessions.length) return { sessions: [], averageMs: null, shortest: null, longest: null, usualStartMinutes: null }
  const averageMs = sessions.reduce((n, w) => n + w.durationMs, 0) / sessions.length
  const shortest = sessions.reduce((a, w) => !a || w.durationMs < a.durationMs ? w : a, null)
  const longest = sessions.reduce((a, w) => !a || w.durationMs > a.durationMs ? w : a, null)
  let sin = 0, cos = 0
  sessions.forEach(w => {
    const d = new Date(w.start), mins = d.getHours() * 60 + d.getMinutes()
    const angle = mins / 1440 * Math.PI * 2
    sin += Math.sin(angle); cos += Math.cos(angle)
  })
  let angle = Math.atan2(sin / sessions.length, cos / sessions.length)
  if (angle < 0) angle += Math.PI * 2
  const usualStartMinutes = Math.round(angle / (Math.PI * 2) * 1440) % 1440
  return { sessions, averageMs, shortest, longest, usualStartMinutes }
}

export function routineConsistency(S, days = 56, now = new Date()) {
  const safe = { ...S, routines: S.routines || [], week: S.week || {}, dayPlan: S.dayPlan || {} }
  const end = new Date(now); end.setHours(12, 0, 0, 0); end.setDate(end.getDate() - 1)
  const byDay = {}
  ;(S.workouts || []).forEach(w => (byDay[w.d] = byDay[w.d] || []).push(w))
  let planned = 0, completed = 0, missed = 0, extra = 0
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end); d.setDate(end.getDate() - i)
    const iso = isoOf(d), routineId = effectiveRoutineId(safe, iso), rows = byDay[iso] || []
    if (routineId) {
      planned++
      const routine = safe.routines.find(r => r.id === routineId)
      const matched = rows.some(w => w.routineId === routineId || (!w.routineId && routine && w.name === routine.name))
      if (matched) completed++; else missed++
    } else if (rows.length) extra++
  }
  return { planned, completed, missed, extra, rate: planned ? completed / planned : null }
}
