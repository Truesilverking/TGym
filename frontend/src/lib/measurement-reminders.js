import { isoOf, todayISO } from './format.js'
import { MEASURE_FIELDS, measurementValue } from './stats-insights.js'

export const REMINDER_METRICS = [['weight', 'Body weight'], ...MEASURE_FIELDS]
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(new Date(value + 'T12:00:00').getTime())
export function reminderInterval(config = {}) {
  const unit = ['days', 'weeks', 'months'].includes(config.intervalUnit) ? config.intervalUnit : 'weeks'
  const limit = { days: 365, weeks: 52, months: 12 }[unit]
  return { unit, value: Math.min(limit, Math.max(1, Math.round(Number(config.intervalValue) || 1))) }
}
export function addReminderInterval(date, config) {
  const { unit, value } = reminderInterval(config)
  const d = new Date(date + 'T12:00:00')
  if (unit === 'months') {
    const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + value)
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()))
  } else d.setDate(d.getDate() + value * (unit === 'weeks' ? 7 : 1))
  return isoOf(d)
}
export function measurementDates(S, metric) {
  const rows = metric === 'weight' ? S.bodyweight : S.measurements
  return [...new Set((rows || []).filter(row => validDate(row.d) && (metric === 'weight' ? Number(row.w) > 0 : measurementValue(row, metric) > 0)).map(row => row.d))].sort()
}
export function measurementReminders(S, today = todayISO()) {
  return REMINDER_METRICS.flatMap(([metric, label]) => {
    const config = S.measurementReminders?.items?.[metric]
    if (!config?.enabled) return []
    const dates = measurementDates(S, metric)
    const last = dates.at(-1) || null
    const base = last || (validDate(config.anchorDate) ? config.anchorDate : today)
    let due = addReminderInterval(base, config)
    // Snooze/skip belongs to this measurement cycle only; an early new entry replaces it.
    if (config.overrideBase === base && validDate(config.overrideUntil) && config.overrideUntil > due) due = config.overrideUntil
    return [{ id: `measurement:${metric}`, metric, label, last, due, base, config,
      status: due < today ? 'Overdue' : due === today ? 'Due today' : 'Upcoming' }]
  })
}
export function measurementEventsOn(S, date) {
  return measurementReminders(S).flatMap(reminder => {
    if (measurementDates(S, reminder.metric).includes(date)) return [{ ...reminder, status: 'Completed' }]
    return reminder.due === date ? [reminder] : []
  })
}
export function postponeMeasurement(S, metric, skip = false, today = todayISO()) {
  const reminder = measurementReminders(S, today).find(r => r.metric === metric)
  if (!reminder) return
  const config = S.measurementReminders.items[metric]
  config.overrideBase = reminder.base
  config.overrideUntil = skip ? addReminderInterval(reminder.due > today ? reminder.due : today, config) : addReminderInterval(today, { intervalValue: 1, intervalUnit: 'days' })
}
export const MEASUREMENT_NOTIFICATION_IDS = Array.from({length: REMINDER_METRICS.length}, (_, i) => 2000 + i)
export function measurementNotificationPlan(S, now = new Date()) {
  if (!S.measurementReminders?.notifications) return []
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(S.measurementReminders.time || '') ? S.measurementReminders.time : '08:00'
  const grouped = new Map()
  for (const reminder of measurementReminders(S, isoOf(now))) {
    const at = new Date(`${reminder.due}T${time}:00`)
    // No repeated overdue nags. Overdue entries stay visible in the app.
    if (at <= now) continue
    if (!grouped.has(reminder.due)) grouped.set(reminder.due, { at, metrics: [], labels: [] })
    grouped.get(reminder.due).metrics.push(reminder.metric)
    grouped.get(reminder.due).labels.push(reminder.label)
  }
  return [...grouped].sort(([a], [b]) => a.localeCompare(b)).map(([, group], i) => ({ ...group, id: MEASUREMENT_NOTIFICATION_IDS[i] }))
}
