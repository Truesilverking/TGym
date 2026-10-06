import { displayReps, isPerSide, modeOf } from './history.js'
import { t, exerciseNameFor, dateLocale } from './i18n.js'
import { exOr } from './exercises.js'
import { workoutElapsedMs } from './workout-time.js'
import { loggedWorkouts } from './daily-plan.js'
import { isoOf } from './format.js'
import { isWarmupRow } from './workout-model.js'

const csvCell = value => {
  const text = String(value ?? '')
  // CSV quoting does not stop spreadsheet formula evaluation of user-entered text.
  const safe = typeof value === 'string' && /^(?:\s*[=+@-]|[\t\r\n])/.test(text) ? "'" + text : text
  return `"${safe.replaceAll('"', '""')}"`
}
export function filteredHistory(S, { query = '', period = 'all', now = Date.now() } = {}) {
  const cutoff = period === 'all' ? '' : isoOf(new Date(now - Number(period) * 86400000))
  const needle = query.trim().toLocaleLowerCase()
  return loggedWorkouts(S).filter(w => (!cutoff || w.d >= cutoff) && (!needle || [w.name, w.d, w.note, ...(w.entries || []).map(e => exerciseNameFor(exOr(e.id))), ...(w.entries || []).map(e => S.exerciseAliases?.[e.id] || '')].join(' ').toLocaleLowerCase().includes(needle)))
}
export function historyCsv(S, filters) {
  const rows = [[t('Date'), t('Start time'), t('End time'), t('Workout duration (min)'), t('Routine'), t('Exercise'), t('Alias'), t('Set'), t('Weight'), t('Unit'), t('Reps'), t('Set duration (s)'), t('Notes'), t('Activity type'), t('Source'), t('Distance (km)'), t('Average heart rate (bpm)'), t('Energy (kcal)'), t('Steps'), t('Elevation gain (m)'), t('Perceived effort (1–10)')]]
  rows[0].push(t('Completed'), t('Warm-up'), t('RIR'), t('RPE'), t('Reps per side'))
  for (const w of filteredHistory(S, filters)) for (const e of w.entries || []) {
    const ex = exOr(e.id)
    const sets = e.sets?.length ? e.sets : [{}]
    const start = Number(w.start) > 0 && Number.isFinite(Number(w.start)) ? new Date(Number(w.start)).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' }) : ''
    const end = Number(w.end) > Number(w.start) ? new Date(Number(w.end)).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' }) : ''
    const duration = Number(w.end) > Number(w.start) ? Math.round(workoutElapsedMs(w) / 60000) : ''
    sets.forEach((s, i) => rows.push([w.d, start, end, duration, w.name, exerciseNameFor(ex), S.exerciseAliases?.[e.id] || '', i + 1, s.w ?? '', s.unit || w.unit || S.unit, displayReps(s.r, e.target) ?? '', s.sec ?? '', w.note || '', w.activity?.type || e.target?.activityType || '', w.activity?.source || '', w.activity?.distanceKm ?? s.distanceKm ?? '', w.activity?.averageHeartRate ?? '', w.activity?.calories ?? '', w.activity?.steps ?? '', w.activity?.elevationM ?? '', w.activity?.rpe ?? '', t(s.done ? 'Completed' : 'Pending'), isWarmupRow(s) ? t('Warm-up') : '', s.rir ?? '', s.rpe ?? '', isPerSide(e.target) && modeOf(e.target) === 'reps' ? displayReps(s.r, e.target) ?? '' : '']))
  }
  return '\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n')
}
