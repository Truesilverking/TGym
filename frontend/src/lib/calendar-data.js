import { dailyPlan } from './daily-plan.js'
import { isUntracked, trackingStart } from './training-history.js'
import { loggedWorkouts } from './consistency.js'
import { isTrainingPaused } from './training-pause.js'
import { consistencyStats } from './consistency.js'
import { effectiveRoutineId } from './history.js'
import { isoOf } from './format.js'
import { measurementEventsOn } from './measurement-reminders.js'

export function calendarDay(state, iso, now = new Date(), context) {
  if (context ? iso < context.start : isUntracked(state, iso, isoOf(now))) return { iso, workouts:[], planned:false, measurements:measurementEventsOn(state, iso), name:'', status:'untracked' }
  state = { ...state, routines:state.routines || [], week:state.week || {}, dayPlan:state.dayPlan || {} }
  const workouts = context ? context.workouts[iso] || [] : loggedWorkouts(state).filter(w => w.d === iso)
  const routine = (state.routines || []).find(r => r.id === effectiveRoutineId(state, iso))
  const plan = dailyPlan(state,iso)
  const planned = plan.total > 0
  return { iso, workouts, planned, plan, measurements: measurementEventsOn(state, iso), name: plan.total > 1 ? `${plan.completed}/${plan.total} · ${plan.items.map(i=>i.routine.name).join(' · ')}` : workouts.at(-1)?.name || routine?.name || '',
    status: planned && plan.completed > 0 && plan.completed < plan.total ? 'partial' : workouts.length && (!planned || plan.completed === plan.total) ? 'completed' : isTrainingPaused(state, iso) ? 'paused' : planned ? (iso < isoOf(now) ? 'missed' : 'pending') : 'rest' }
}
const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
export function calendarPeriod(state, anchor, period, now = new Date()) {
  const start = new Date(anchor); start.setHours(12,0,0,0)
  if (period === 'week') start.setDate(start.getDate() - (start.getDay()+6)%7)
  else { start.setDate(1); if (period !== 'month') start.setMonth(0) }
  const end = new Date(start)
  if (period === 'week') end.setDate(end.getDate()+6)
  else if (period === 'month') { end.setMonth(end.getMonth()+1); end.setDate(0) }
  else { end.setFullYear(end.getFullYear()+1); end.setDate(0) }
  const context = { start:trackingStart(state,isoOf(now)), workouts:{} }
  for (const w of loggedWorkouts(state)) (context.workouts[w.d] ||= []).push(w)
  const days = []
  for (const d = new Date(start); d <= end; d.setDate(d.getDate()+1)) days.push(calendarDay(state, iso(d), now, context))
  const counts = { scheduled: 0, completed: 0, missed: 0, pending: 0, partial: 0, rest: 0, paused: 0, untracked: 0 }
  for (const day of days) { counts[day.status]++; if (day.planned) counts.scheduled++ }
  const stats = consistencyStats(state, iso(start), iso(end), now)
  return { days, counts, stats, completion: stats.rate == null ? null : Math.round(stats.rate * 100), start: iso(start), end: iso(end) }
}
export function calendarFilename(period, start, end, format) {
  const stem = period === 'week' ? `TGym-Consistency-Week-${start}` : period === 'full' ? `TGym-Consistency-Report-${start.slice(0,4)}` : `TGym-Consistency-${start.slice(0, period === 'month' ? 7 : 4)}`
  return `${stem}.${format}`
}
