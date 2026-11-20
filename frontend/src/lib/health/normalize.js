import { emptyDailyHealthSnapshot, HRV_METRICS } from './model.js'
const numberOrNull = value => !['number','string'].includes(typeof value) || String(value).trim() === '' || !Number.isFinite(Number(value)) ? null : Number(value)
const tempC = (value, unit) => { const n = numberOrNull(value); return n == null ? null : unit === 'f' ? (n - 32) * 5 / 9 : n }
const unique = values => [...new Set((values || []).filter(Boolean))]

export function normalizeDailyHealth(input = {}) {
  const out = emptyDailyHealthSnapshot({ date: input.date, timezone: input.timezone })
  for (const key of ['steps','distanceMeters','activeEnergyKcal','totalEnergyKcal','exerciseMinutes','activeMinutes','restingHeartRate','averageHeartRate','minHeartRate','maxHeartRate','respiratoryRate','sleepRespiratoryRate','spo2Average','spo2Min']) out[key] = numberOrNull(input[key])
  if (input.distanceKm != null) {
    const km = numberOrNull(input.distanceKm)
    out.distanceMeters = km == null ? null : km * 1000
  }
  const hrv = numberOrNull(input.hrv?.valueMs)
  if (hrv != null) out.hrv = { valueMs: hrv, metric: HRV_METRICS.includes(input.hrv.metric) ? input.hrv.metric : 'other', source: input.hrv.source || null }
  out.sleep = { ...out.sleep, ...(input.sleep || {}) }
  for (const key of Object.keys(out.sleep)) if (!['start','end'].includes(key)) out.sleep[key] = numberOrNull(out.sleep[key])
  out.skinTemperatureC = input.skinTemperatureC != null ? numberOrNull(input.skinTemperatureC) : tempC(input.skinTemperature, input.temperatureUnit)
  const delta = numberOrNull(input.skinTemperatureDelta)
  out.skinTemperatureDeltaC = input.skinTemperatureDeltaC != null ? numberOrNull(input.skinTemperatureDeltaC)
    : delta == null ? null : input.temperatureUnit === 'f' ? delta * 5 / 9 : delta
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
