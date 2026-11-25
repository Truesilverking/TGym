import { isoOf } from '../format.js'
import { weightConversionFactor, weightUnit } from '../weight-units.js'

export const WITHINGS_ANDROID_PACKAGE = 'com.withings.wiscale2'
const finite = value => typeof value === 'number' && Number.isFinite(value)
const measuredNumber = value => (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') && Number.isFinite(Number(value)) ? Number(value) : null
const invalid = () => new Error('Invalid Health Connect weight response')
const keyFor = id => `health-connect:${WITHINGS_ANDROID_PACKAGE}:${id}`

// Native reads are bounded, complete snapshots. Reject malformed Withings rows
// before touching state, rather than reporting a successful partial import.
export function healthConnectWeightRecords(data, now = Date.now()) {
  if (!data || data.complete !== true || !Array.isArray(data.records) || data.records.length > 5000 ||
    !finite(data.from) || !finite(data.to) || data.from < 0 || data.to <= data.from ||
    data.to > now + 60000 || data.to - data.from > 30 * 86400000) throw invalid()
  const unique = new Map()
  for (const row of data.records) {
    if (row?.origin !== WITHINGS_ANDROID_PACKAGE) continue
    if (typeof row.id !== 'string' || !/^[A-Za-z0-9_-]{1,256}$/.test(row.id) ||
      !finite(row.time) || row.time <= 0 || row.time < data.from || row.time >= data.to || row.time > now ||
      !finite(row.updatedAt) || row.updatedAt <= 0 || row.updatedAt > now + 60000 ||
      !finite(row.weightKg) || row.weightKg <= 0 || row.weightKg > 600) throw invalid()
    const record = { id: keyFor(row.id), providerId: row.id, source: 'health-connect', origin: row.origin,
      updatedAt: row.updatedAt, t: row.time, d: isoOf(new Date(row.time)), weightKg: row.weightKg }
    const previous = unique.get(record.id)
    if (previous && previous.updatedAt === record.updatedAt &&
      (previous.t !== record.t || previous.weightKg !== record.weightKg)) throw invalid()
    if (!previous || record.updatedAt > previous.updatedAt) unique.set(record.id, record)
  }
  return [...unique.values()].sort((a, b) => a.t - b.t || a.id.localeCompare(b.id))
}

function normalizeDay(day, unit) {
  const source = weightUnit(day.unit, unit)
  const recorded = measuredNumber(day.w)
  const samples = Array.isArray(day.samples) && day.samples.length ? day.samples
    : recorded > 0 ? [{ w: recorded, t: day.t, unit: source }] : []
  day.samples = samples.filter(sample => sample && typeof sample === 'object').map(sample => ({ ...sample,
    w: Number(sample.w) * weightConversionFactor(weightUnit(sample.unit, source), unit), unit }))
  day.unit = unit
}
function average(day) {
  const values = day.samples.map(sample => sample.w).filter(value => finite(value) && value > 0)
  if (values.length) day.w = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10
  const times = day.samples.map(sample => sample.t).filter(finite)
  if (times.length) day.t = Math.max(...times)
}
const hasIdentity = (sample, id) => sample?.id === id || sample?.healthConnect?.id === id
function sameApiReading(sample, day, record, unit) {
  if (sample?.source !== 'withings' || sample.healthConnect || !finite(sample.t) || Math.floor(sample.t / 1000) !== Math.floor(record.t / 1000)) return false
  const kg = Number(sample.w) * weightConversionFactor(weightUnit(sample.unit, weightUnit(day.unit, unit)), 'kg')
  // Historic unit conversions round to two decimals; tolerate only that rounding
  // while requiring the same provider and measured second.
  return finite(kg) && Math.abs(kg - record.weightKg) <= 0.005
}

/** Merge only Withings-origin weight. No other measurements or workout state. */
export function mergeHealthConnectWeightRecords(state, data, now = Date.now()) {
  const records = healthConnectWeightRecords(data, now)
  const result = { added: 0, updated: 0, unchanged: 0, readings: records.length }
  if (!Array.isArray(state.bodyweight)) state.bodyweight = []
  const unit = state.unit === 'lb' ? 'lb' : 'kg'
  for (const record of records) {
    let previous = state.bodyweight.find(day => day.samples?.some(sample => hasIdentity(sample, record.id)))
    let old = previous?.samples.find(sample => hasIdentity(sample, record.id))
    let linked = false
    if (!old) {
      previous = state.bodyweight.find(day => day.d === record.d && day.samples?.some(sample => sameApiReading(sample, day, record, unit)))
      old = previous?.samples.find(sample => sameApiReading(sample, previous, record, unit))
      linked = Boolean(old)
    }
    const previousUpdatedAt = old?.healthConnect?.updatedAt ?? old?.updatedAt
    // Equal native revision timestamps carry no evidence of newer data. An API
    // revision may already have refreshed an aliased sample since this HC read.
    if (old && !linked && finite(previousUpdatedAt) && previousUpdatedAt >= record.updatedAt) { result.unchanged++; continue }
    const w = record.weightKg * weightConversionFactor('kg', unit)
    if (previous) normalizeDay(previous, unit)
    old = previous?.samples.find(sample => hasIdentity(sample, record.id)) || (linked ? previous?.samples.find(sample => sameApiReading(sample, previous, record, unit)) : null)
    const next = old?.source === 'withings'
      ? { ...old, w, t: record.t, unit, healthConnect: { id: record.id, origin: record.origin, updatedAt: record.updatedAt } }
      : { ...old, id: record.id, providerId: record.providerId, source: record.source, origin: record.origin,
        updatedAt: record.updatedAt, w, t: record.t, unit }
    if (previous && old) {
      previous.samples = previous.samples.filter(sample => sample !== old)
      if (!previous.samples.length) state.bodyweight = state.bodyweight.filter(day => day !== previous)
      else average(previous)
    }
    let day = state.bodyweight.find(day => day.d === record.d)
    if (!day) { day = { d: record.d, w, t: record.t, unit, samples: [] }; state.bodyweight.push(day) }
    else normalizeDay(day, unit)
    day.samples.push(next); average(day)
    result[old ? 'updated' : 'added']++
  }
  state.bodyweight.sort((a, b) => a.d.localeCompare(b.d))
  return result
}

// The inverse API importer can use the same conservative cross-source match.
export function isSameWithingsWeightSample(sample, day, { t, weightKg }, unit = 'kg') {
  if (sample?.source !== 'health-connect' || sample.origin !== WITHINGS_ANDROID_PACKAGE || sample.withingsId || !finite(sample.t) || !finite(t) || Math.floor(sample.t / 1000) !== Math.floor(t / 1000)) return false
  const kg = Number(sample.w) * weightConversionFactor(weightUnit(sample.unit, weightUnit(day.unit, unit)), 'kg')
  return finite(kg) && finite(weightKg) && Math.abs(kg - weightKg) <= 0.005
}
