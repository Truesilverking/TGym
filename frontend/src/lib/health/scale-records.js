import { isoOf } from '../format.js'
import { recordHeight } from '../body-records.js'
import { weightConversionFactor, weightUnit } from '../weight-units.js'

const LB_PER_KG = 2.2046226218487757
const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null
const measured = (measures, type, max) => {
  const row = measures.find(row => row?.type === type && number(row.value) !== null && Number.isInteger(row.unit) && row.unit >= -12 && row.unit <= 6)
  const value = row ? row.value * 10 ** row.unit : null
  return value > 0 && value <= max ? value : null
}

export function withingsRecords(records, now = Date.now()) {
  if (!Array.isArray(records) || records.length > 10000) throw Error('Invalid scale response')
  const unique = new Map()
  for (const row of records) {
    if (!row || row.category !== 1 || !/^[a-zA-Z0-9_-]{1,128}$/.test(String(row.id ?? '')) || number(row.date) === null || row.date <= 0 || row.date * 1000 > now || !Array.isArray(row.measures)) continue
    const t = row.date * 1000, date = new Date(t)
    if (!Number.isFinite(date.getTime())) continue
    const normalized = { id: `withings:${row.id}`, d: isoOf(date), t, source: 'withings' }
    for (const [key, type, max] of [['weight',1,600],['heightM',4,3],['bodyFatPct',6,100],['bodyFatMass',8,600]]) {
      const value = measured(row.measures, type, max)
      if (value !== null) normalized[key] = value
    }
    // Generic fat-free/muscle mass is not the skeletal-muscle metric used by TGym.
    if (Object.keys(normalized).length > 4) unique.set(normalized.id, normalized)
  }
  return [...unique.values()].sort((a,b) => a.t - b.t || a.id.localeCompare(b.id))
}

function average(row) {
  const values = row.samples.map(x => Number(x?.w)).filter(n => Number.isFinite(n) && n > 0)
  if (values.length) row.w = Math.round(values.reduce((a,n) => a+n,0) / values.length * 10) / 10
}
function normalizeDay(day, unit) {
  const source = weightUnit(day.unit, unit)
  if (!Array.isArray(day.samples) || !day.samples.length) day.samples = Number(day.w) > 0 ? [{ w: day.w, t: day.t, unit: source }] : []
  day.samples = day.samples.filter(sample => sample && typeof sample === 'object').map(sample => ({ ...sample, w: Number(sample.w) * weightConversionFactor(weightUnit(sample.unit, source), unit), unit }))
  day.unit = unit
  average(day)
}

// Same daily-average convention as manual weigh-ins; stable provider IDs make
// foreground retries and revised measurements idempotent. Manual samples survive.
export function mergeScaleRecords(state, records, now = Date.now()) {
  const rows = withingsRecords(records, now), result = { added: 0, updated: 0, unchanged: 0 }
  if (!Array.isArray(state.bodyweight)) state.bodyweight = []
  if (!Array.isArray(state.inbody)) state.inbody = []
  const unit = state.unit === 'lb' ? 'lb' : 'kg'
  for (const record of rows) {
    let changed = false, existed = false
    if (record.weight != null) {
      const w = record.weight * (unit === 'lb' ? LB_PER_KG : 1)
      const sample = { id: record.id, source: 'withings', w, t: record.t, unit }
      let day = state.bodyweight.find(row => row.d === record.d)
      const previous = state.bodyweight.find(row => row.samples?.some(s => s.id === record.id))
      if (day) normalizeDay(day, unit)
      if (previous && previous !== day) normalizeDay(previous, unit)
      const old = previous?.samples.find(s => s.id === record.id)
      existed ||= Boolean(old)
      if (!old || old.w !== w || old.t !== record.t || previous.d !== record.d) {
        if (previous) {
          previous.samples = previous.samples.filter(s => s.id !== record.id)
          if (!previous.samples.length) { state.bodyweight = state.bodyweight.filter(row => row !== previous); if (day === previous) day = null }
          else average(previous)
        }
        if (!day) { day = { d: record.d, w, t: record.t, unit, samples: [] }; state.bodyweight.push(day) }
        day.samples.push(sample); day.t = Math.max(Number(day.t) || 0, record.t); average(day); changed = true
      }
    }
    if (record.bodyFatPct != null || record.bodyFatMass != null) {
      const next = { id: record.id, d: record.d, t: record.t, source: 'withings', ...(record.weight != null ? { weight: record.weight } : {}), ...(record.bodyFatPct != null ? { bodyFatPct: record.bodyFatPct } : {}), ...(record.bodyFatMass != null ? { bodyFatMass: record.bodyFatMass } : {}) }
      const index = state.inbody.findIndex(row => row.id === record.id)
      existed ||= index >= 0
      if (index < 0) { state.inbody.push(next); changed = true }
      else if (Object.keys(next).some(key => next[key] !== state.inbody[index][key])) { state.inbody[index] = { ...state.inbody[index], ...next }; changed = true }
    }
    if (record.heightM != null) {
      const previous = state.heightHistory?.find(row => row.id === record.id || row.d === record.d)
      existed ||= Boolean(previous)
      // Keep a newer/manual reading from the same day. Scale heights are often
      // account settings rather than a newly measured height.
      if (!previous && (!state.heightCm || state.heightRecordedAt && record.d > state.heightRecordedAt)) {
        recordHeight(state, record.heightM * 100 / (state.measurementUnit === 'in' ? 2.54 : 1), record.d, record.t, record.id)
        changed = true
      }
    }
    result[!changed ? 'unchanged' : existed ? 'updated' : 'added']++
  }
  state.bodyweight.sort((a,b) => a.d.localeCompare(b.d)); state.inbody.sort((a,b) => a.d.localeCompare(b.d))
  return result
}
