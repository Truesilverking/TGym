import { describe, expect, it } from 'vitest'
import { dedupeWearableWorkouts, getRecoveryInputs, normalizeDailyHealth } from './normalize.js'
describe('health normalization contract', () => {
  it('keeps missing metrics null and does not invent sleep stages', () => { const x = normalizeDailyHealth({ date: '2026-09-07', sleep: { totalMinutes: 420 } }); expect(x.spo2Average).toBeNull(); expect(x.sleep.deepMinutes).toBeNull() })
  it('normalizes distance and temperature while preserving timezone', () => { const x = normalizeDailyHealth({ timezone: 'America/Santo_Domingo', distanceKm: 2.5, skinTemperature: 98.6, temperatureUnit: 'f' }); expect(x.distanceMeters).toBe(2500); expect(x.skinTemperatureC).toBeCloseTo(37); expect(x.timezone).toBe('America/Santo_Domingo') })
  it('preserves HRV method and namespaces vendor metrics', () => { const x = normalizeDailyHealth({ hrv: { valueMs: 48, metric: 'rmssd', source: 'ring' }, vendorMetrics: [{ source: 'oura', metricName: 'readiness', value: 83, scale: '0-100' }] }); expect(x.hrv.metric).toBe('rmssd'); expect(x.vendorMetrics[0]).toMatchObject({ source: 'oura', metricName: 'readiness' }) })
  it('deduplicates workouts without adding their values', () => { const rows = dedupeWearableWorkouts([{ source: 'healthkit', sourceWorkoutId: '1', activeEnergyKcal: 100 }, { source: 'healthkit', sourceWorkoutId: '1', activeEnergyKcal: 100 }]); expect(rows).toHaveLength(1); expect(rows[0].activeEnergyKcal).toBe(100) })
  it('does not claim recovery from one input', () => { expect(getRecoveryInputs(normalizeDailyHealth({ restingHeartRate: 52 })).status).toBe('insufficient-data') })
  it('preserves invalid or missing numeric values as unknown, including distance', () => {
    for (const value of ['', ' ', 'invalid', true, [], {}, Infinity, NaN]) {
      const snapshot = normalizeDailyHealth({ distanceKm: value, steps: value })
      expect(snapshot.distanceMeters).toBeNull()
      expect(snapshot.steps).toBeNull()
    }
    expect(normalizeDailyHealth({ distanceKm: 0, steps: 0 })).toMatchObject({ distanceMeters: 0, steps: 0 })
  })
  it('does not apply the Fahrenheit offset to a temperature difference or an explicit Celsius field', () => {
    expect(normalizeDailyHealth({ skinTemperature: 98.6, skinTemperatureDelta: 1.8, temperatureUnit: 'f' })).toMatchObject({ skinTemperatureC: 37, skinTemperatureDeltaC: 1 })
    expect(normalizeDailyHealth({ skinTemperatureC: 36.5, skinTemperatureDeltaC: .5, temperatureUnit: 'f' })).toMatchObject({ skinTemperatureC: 36.5, skinTemperatureDeltaC: .5 })
  })
  it('does not count invalid HRV as a second recovery signal', () => {
    expect(getRecoveryInputs(normalizeDailyHealth({ restingHeartRate: 52, hrv: { valueMs: 'unknown', metric: 'rmssd' } })).status).toBe('insufficient-data')
  })
})
