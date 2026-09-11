import { effectiveRoutine } from './history.js'
import { isoOf } from './format.js'

export const WORKOUT_NOTIFICATION_IDS = [100, 101, 102, 103, 104, 105, 106]
const timeOf = (value, fallback) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '') ? value : fallback
export function workoutNotificationPlan(state, now = new Date()) {
  if (!state.reminder?.on) return []
  const S = {week:{},dayPlan:{},routines:[],workouts:[],...state}
  const today = isoOf(now), settings = S.reminder
  const pending = date => {
    const routine = effectiveRoutine(S,date)
    // The current calendar model treats any saved session as completing that day.
    return routine && !S.workouts.some(w=>w.d === date) ? routine : null
  }
  const atTime = (date, time) => {
    const at = new Date(`${date}T${time}:00`)
    if (settings.quietOn) {
      const from = timeOf(settings.quietStart,'22:00'), to = timeOf(settings.quietEnd,'07:00')
      const quiet = from < to ? time >= from && time < to : from !== to && (time >= from || time < to)
      if (quiet) return null
    }
    return at > now ? at : null
  }
  const notices = [], routine = pending(today)
  const at = atTime(today,timeOf(settings.dayTimes?.[now.getDay()] || settings.time,'08:00'))
  if (routine && at) notices.push({id:100,kind:'today',routineId:routine.id,name:routine.name,date:today,at})
  const nextAt = atTime(today,timeOf(settings.nextTime,'19:00'))
  if (nextAt) {
    const day = new Date(`${today}T12:00:00`)
    for (let offset=1;offset<=366;offset++) {
      day.setDate(day.getDate()+1)
      const date = isoOf(day), next = pending(date)
      if (next) { notices.push({id:101,kind:offset===1?'tomorrow':'next',routineId:next.id,name:next.name,date,at:nextAt}); break }
    }
  }
  return notices
}
