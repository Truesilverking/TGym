export const HEALTH_SOURCE = Object.freeze({ HEALTH_CONNECT: 'health-connect', HEALTHKIT: 'healthkit' })
export const HRV_METRICS = Object.freeze(['rmssd', 'sdnn', 'other'])
export const emptyDailyHealthSnapshot = ({ date, timezone = Intl.DateTimeFormat().resolvedOptions().timeZone } = {}) => ({
  date: date || null, timezone: timezone || null,
  steps: null, distanceMeters: null, activeEnergyKcal: null, totalEnergyKcal: null, exerciseMinutes: null, activeMinutes: null,
  restingHeartRate: null, averageHeartRate: null, minHeartRate: null, maxHeartRate: null, heartRateSamples: null,
  hrv: null,
  sleep: { start: null, end: null, totalMinutes: null, timeInBedMinutes: null, awakeMinutes: null, lightMinutes: null, deepMinutes: null, remMinutes: null },
  respiratoryRate: null, sleepRespiratoryRate: null, spo2Average: null, spo2Min: null,
  skinTemperatureC: null, skinTemperatureDeltaC: null,
  wearableWorkouts: [], vendorMetrics: [], sources: [], sourcesByMetric: {},
})
