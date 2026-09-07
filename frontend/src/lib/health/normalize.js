import { emptyDailyHealthSnapshot, HRV_METRICS } from './model.js'
const numberOrNull = value => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value)
const tempC = (value, unit) => { const n = numberOrNull(value); return n == null ? null : unit === 'f' ? (n - 32) * 5 / 9 : n }
const unique = values => [...new Set((values || []).filter(Boolean))]

export function normalizeDailyHealth(input = {}) {
  const out = emptyDailyHealthSnapshot({ date: input.date, timezone: input.timezone })
  for (const key of ['steps','distanceMeters','activeEnergyKcal','totalEnergyKcal','exerciseMinutes','activeMinutes','restingHeartRate','averageHeartRate','minHeartRate','maxHeartRate','respiratoryRate','sleepRespiratoryRate','spo2Average','spo2Min']) out[key] = numberOrNull(input[key])
  if (input.distanceKm != null) out.distanceMeters = numberOrNull(input.distanceKm) * 1000
  if (input.hrv?.valueMs != null) out.hrv = { valueMs: numberOrNull(input.hrv.valueMs), metric: HRV_METRICS.includes(input.hrv.metric) ? input.hrv.metric : 'other', source: input.hrv.source || null }
  out.sleep = { ...out.sleep, ...(input.sleep || {}) }
  for (const key of Object.keys(out.sleep)) if (!['start','end'].includes(key)) out.sleep[key] = numberOrNull(out.sleep[key])
  out.skinTemperatureC = tempC(input.skinTemperature ?? input.skinTemperatureC, input.temperatureUnit)
  out.skinTemperatureDeltaC = input.skinTemperatureDeltaC == null ? null : tempC(input.skinTemperatureDeltaC, input.temperatureUnit)
  out.heartRateSamples = Array.isArray(input.heartRateSamples) ? input.heartRateSamples.map(x => ({ timestamp: x.timestamp, bpm: numberOrNull(x.bpm), source: x.source || null })).filter(x => x.timestamp && x.bpm != null) : null
  out.wearableWorkouts = dedupeWearableWorkouts(input.wearableWorkouts || [])
  out.vendorMetrics = (input.vendorMetrics || []).filter(x => x?.source && x?.metricName && numberOrNull(x.value) != null).map(x => ({ source: x.source, metricName: x.metricName, value: Number(x.value), scale: x.scale ?? null }))
  out.sources = unique(input.sources)
  out.sourcesByMetric = { ...(input.sourcesByMetric || {}) }
  return out
}

export function dedupeWearableWorkouts(rows) {
  const seen = new Set(), out = []
  for (const row of rows || []) {
    const key = row.sourceWorkoutId ? `${row.source || ''}:${row.sourceWorkoutId}` : `${row.start || ''}:${row.end || ''}:${row.activityType || ''}`
    if (seen.has(key)) continue
    seen.add(key); out.push({ ...row, durationSeconds: numberOrNull(row.durationSeconds), activeEnergyKcal: numberOrNull(row.activeEnergyKcal), averageHeartRate: numberOrNull(row.averageHeartRate), maxHeartRate: numberOrNull(row.maxHeartRate) })
  }
  return out
}

export function getRecoveryInputs(snapshot, recentTrainingLoad = null) {
  if (!snapshot) return { status: 'insufficient-data', sleepMinutes: null, restingHeartRate: null, hrv: null, recentTrainingLoad }
  const result = { sleepMinutes: snapshot.sleep?.totalMinutes ?? null, restingHeartRate: snapshot.restingHeartRate ?? null, hrv: snapshot.hrv ?? null, recentTrainingLoad }
  return { status: Object.values(result).filter(v => v != null).length >= 2 ? 'available' : 'insufficient-data', ...result }
}
