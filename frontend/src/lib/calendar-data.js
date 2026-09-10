import { effectiveRoutineId } from './history.js'
import { todayISO } from './format.js'
import { measurementEventsOn } from './measurement-reminders.js'

export function calendarDay(state, iso) {
  const workouts = state.workouts.filter(w => w.d === iso)
  const routine = state.routines.find(r => r.id === effectiveRoutineId(state, iso))
  const planned = !!effectiveRoutineId(state, iso)
  return { iso, workouts, planned, measurements: measurementEventsOn(state, iso), name: workouts.at(-1)?.name || routine?.name || '',
    status: workouts.length ? 'completed' : planned ? (iso < todayISO() ? 'missed' : 'pending') : 'rest' }
}
const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
export function calendarPeriod(state, anchor, period) {
  const start = new Date(anchor); start.setHours(12,0,0,0)
  if (period === 'week') start.setDate(start.getDate() - (start.getDay()+6)%7)
  else { start.setDate(1); if (period !== 'month') start.setMonth(0) }
  const end = new Date(start)
  if (period === 'week') end.setDate(end.getDate()+6)
  else if (period === 'month') { end.setMonth(end.getMonth()+1); end.setDate(0) }
  else { end.setFullYear(end.getFullYear()+1); end.setDate(0) }
  const days = []
  for (const d = new Date(start); d <= end; d.setDate(d.getDate()+1)) days.push(calendarDay(state, iso(d)))
  const counts = { scheduled: 0, completed: 0, missed: 0, pending: 0, rest: 0 }
  for (const day of days) { counts[day.status]++; if (day.planned) counts.scheduled++ }
  const completedScheduled = days.filter(d => d.planned && d.status === 'completed').length
  return { days, counts, completion: counts.scheduled ? Math.round(completedScheduled/counts.scheduled*100) : 0, start: iso(start), end: iso(end) }
}
export function calendarFilename(period, start, end, format) {
  const stem = period === 'week' ? `TGym-Calendar-Week-${start}_to_${end}` : period === 'full' ? `TGym-Training-Calendar-Report-${start.slice(0,4)}` : `TGym-Calendar-${start.slice(0, period === 'month' ? 7 : 4)}`
  return `${stem}.${format}`
}
