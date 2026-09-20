import { consistencyStats } from './consistency.js'
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

export function validTimedSessions(workouts, { activeId } = {}) {
  const seen = new Set()
  const timestamp = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) && Number.isFinite(new Date(Number(value)).getTime())
  return (workouts || []).flatMap(w => {
    if (!w || w.active || (activeId != null && w.id === activeId) || w.cancelled || w.canceled || ['active','cancelled','canceled'].includes(w.status) || ['cancelled','canceled'].includes(w.finishReason)) return []
    if (!timestamp(w.start) || !timestamp(w.end) || Number(w.end) < Number(w.start)) return []
    const paused = Number(w.pausedDurationMs ?? 0)
    if (!Number.isFinite(paused) || paused < 0 || paused > Number(w.end)-Number(w.start)) return []
    if (w.timerPausedAt != null && (!timestamp(w.timerPausedAt) || Number(w.timerPausedAt) < Number(w.start) || Number(w.timerPausedAt) > Number(w.end))) return []
    const durationMs = workoutElapsedMs(w)
    // No maximum duration: length alone cannot establish that historical data is corrupt.
    if (!Number.isFinite(durationMs) || durationMs <= 0) return []
    const key = w.id != null ? `id:${w.id}` : JSON.stringify([w.start,w.end,w.routineId ?? null,w.name ?? '',w.entries ?? [],paused])
    if (seen.has(key)) return []
    seen.add(key)
    return [{ ...w, durationMs }]
  })
}

export function routineDurationSummary(workouts, { routines = [], activeId, days = 0, now = Date.now() } = {}) {
  const groups = new Map()
  const cutoff = days > 0 ? now - days * 86400000 : -Infinity
  for (const w of validTimedSessions(workouts, { activeId })) {
    if (Number(w.start) < cutoff || Number(w.start) > now) continue
    // Legacy names never merge into a known ID: two routines can have the same name.
    const key = w.routineId != null ? `id:${w.routineId}` : `legacy:${w.name || ''}`
    if (!groups.has(key)) groups.set(key, { key, routineId:w.routineId ?? null, name:routines.find(r=>r.id===w.routineId)?.name || w.name || '', durations:[] })
    groups.get(key).durations.push(w.durationMs)
  }
  return [...groups.values()].map(({durations,...group}) => {
    durations.sort((a,b)=>a-b)
    const count = durations.length, mid = Math.floor(count/2)
    return {...group,count,meanMs:durations.reduce((sum,ms)=>sum+ms,0)/count,medianMs:count%2 ? durations[mid] : (durations[mid-1]+durations[mid])/2}
  }).sort((a,b)=>b.count-a.count || a.name.localeCompare(b.name))
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
  const end = new Date(now); end.setDate(end.getDate() - 1)
  const start = new Date(end); start.setDate(start.getDate() - days + 1)
  return consistencyStats(S, isoOf(start), isoOf(end), now)
}
