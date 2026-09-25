import { isTrainingPaused } from './training-pause.js'

// Accept legacy scalar assignments everywhere, including imports not yet migrated.
export const routineIds = value => [...new Set((Array.isArray(value) ? value : value && value !== 'rest' ? [value] : []).filter(id => typeof id === 'string' && id && id !== 'rest'))]
export function scheduledRoutineIds(S, date) {
  if (isTrainingPaused(S, date) || (S.scheduleStarted && date < S.scheduleStarted)) return []
  const override = S.dayPlan?.[date]
  const ids = routineIds(override !== undefined ? override : S.week?.[new Date(date + 'T12:00:00').getDay()])
  return ids.filter(id => (S.routines || []).some(r => r.id === id && (!r.scheduledFrom || date >= r.scheduledFrom)))
}
export const matchesScheduled = (w, id, routines) => w.routineId === id || (!w.routineId && routines.some(r => r.id === id && r.name === w.name))
export function loggedWorkouts(S) {
  const seen = new Set()
  return (S.workouts || []).filter(w => {
    if (!w || w.active || (w.id != null && w.id === S.active?.id) || w.cancelled || w.canceled || ['active','cancelled','canceled'].includes(w.status) || ['cancelled','canceled'].includes(w.finishReason)) return false
    if (w.id != null) { if (seen.has(w.id)) return false; seen.add(w.id) }
    return true
  })
}
export function dailyPlan(S, date) {
  const workouts = loggedWorkouts(S).filter(w => w.d === date), matched = new Set()
  const items = scheduledRoutineIds(S,date).map((id,index) => {
    const routine = S.routines.find(r => r.id === id)
    const session = workouts.find(w => !matched.has(w) && matchesScheduled(w,id,S.routines))
    if (session) matched.add(session)
    return {id, routine, index, session, status: session ? 'completed' : routineIds(S.daySkipped?.[date]).includes(id) ? 'skipped' : 'pending'}
  })
  return {date, items, total:items.length, completed:items.filter(i=>i.status==='completed').length,
    skipped:items.filter(i=>i.status==='skipped').length, pending:items.filter(i=>i.status==='pending'),
    extra:workouts.filter(w=>!matched.has(w)).length}
}
export const nextDailyRoutine = (S,date) => dailyPlan(S,date).pending[0]?.routine || null
export function skipDailyRoutine(S,date,id) {
  S.daySkipped ||= {}
  S.daySkipped[date] = routineIds([...routineIds(S.daySkipped[date]),id])
}
export function removeRoutineAssignments(S,id) {
  for (const key of ['week','dayPlan','daySkipped']) for (const day of Object.keys(S[key] || {})) {
    if (routineIds(S[key][day]).includes(id)) S[key][day] = routineIds(S[key][day]).filter(r=>r!==id)
  }
}
