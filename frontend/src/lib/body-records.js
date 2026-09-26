// Keep record identity separate from its editable measurement date.
export function upsertBodyRecord(rows, record, originalIndex = -1) {
  const result = [...(rows || [])]
  const index = result.findIndex(r => r.id && r.id === record.id)
  const target = index >= 0 ? index : originalIndex
  if (target >= 0 && target < result.length) result[target] = {...result[target], ...record}
  else result.push(record)
  return result.sort((a,b)=>a.d.localeCompare(b.d))
}
export function parseMetrics(values, fields) {
  const parsed = {}
  for (const [key] of fields) {
    const raw = values[key]
    if (raw == null || String(raw).trim() === '') { parsed[key] = null; continue }
    const text = String(raw).trim().replace(',', '.')
    if (!/^\d+(?:\.\d+)?$/.test(text)) return null
    const value = Number(text)
    if (!Number.isFinite(value) || value <= 0 || (['bodyFatPct','score'].includes(key) && value > 100)) return null
    parsed[key] = Math.round(value * 100) / 100
  }
  return parsed
}
export function validMeasurementDate(date, today) {
  if (!date || !Number.isFinite(new Date(date+'T12:00:00Z').getTime())) return false
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today && new Date(date+'T12:00:00Z').toISOString().slice(0,10) === date
}

// New height readings retain their predecessors. Canonical centimetres keep this
// additive history independent of display-unit conversion and older backups.
export function recordHeight(state, value, date, timestamp, id) {
  state.heightHistory ||= []
  if (!state.heightHistory.length && state.heightCm > 0 && validMeasurementDate(state.heightRecordedAt, date)) {
    state.heightHistory.push({id:id+'-previous',d:state.heightRecordedAt,cm:state.heightCm*(state.measurementUnit==='in'?2.54:1)})
  }
  state.heightHistory.push({id,d:date,t:timestamp,cm:value*(state.measurementUnit==='in'?2.54:1)})
  state.heightCm=value;state.heightRecordedAt=date
}
