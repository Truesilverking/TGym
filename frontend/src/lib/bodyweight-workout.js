import { todayISO } from './format.js'
import { validMeasurementDate } from './body-records.js'
import { weightConversionFactor, weightUnit } from './weight-units.js'

const numeric = value => typeof value === 'number' || typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN

// Reuse only a real daily entry. Reading a stored aggregate must never invent a
// new weigh-in, change its samples, or borrow yesterday's value for today.
export function dailyWeightForWorkout(state, day = todayISO(), now = Date.now()) {
  if (!validMeasurementDate(day, todayISO()) || !Number.isFinite(now)) return null
  const unit = weightUnit(state?.unit, 'kg')
  let selected = null, latest = -Infinity
  for (const row of Array.isArray(state?.bodyweight) ? state.bodyweight : []) {
    if (!row || row.d !== day || row.unit != null && !['kg', 'lb'].includes(row.unit)) continue
    const weight = numeric(row.w)
    const measuredAt = row.t == null ? 0 : numeric(row.t)
    if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(measuredAt) || measuredAt < 0 || measuredAt > now) continue
    const converted = weight * weightConversionFactor(weightUnit(row.unit, unit), unit)
    if (!Number.isFinite(converted) || converted <= 0 || converted > Number.MAX_SAFE_INTEGER || measuredAt < latest) continue
    selected = converted; latest = measuredAt
  }
  return selected
}
