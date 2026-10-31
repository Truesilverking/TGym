import { MEASURE_FIELDS, measurementValue } from './stats-insights.js'
import { validDate } from './training-history.js'
import { CM_PER_IN } from './unit-conversion.js'

export function measurementInUnit(row,key,unit='cm') {
  const n=measurementValue(row,key),from=row?.unit==='in'?'in':row?.unit==='cm'?'cm':unit
  return Number.isFinite(n)&&n>0?n*(from===unit?1:from==='in'?CM_PER_IN:1/CM_PER_IN):null
}

// A read-only projection. Never fill missing measurements from another date.
export function bodyRecords(S, range) {
  const unit=S.measurementUnit==='in'?'in':'cm'
  return (S.measurements||[]).map((row,index)=>({
    id:String(index),d:row.d,unit,
    values:Object.fromEntries(MEASURE_FIELDS.map(([key])=>[key,measurementInUnit(row,key,unit)])),
  })).filter(r=>validDate(r.d)&&r.d>=range.start&&r.d<=range.end&&Object.values(r.values).some(v=>v!=null)).sort((a,b)=>a.d.localeCompare(b.d)||Number(a.id)-Number(b.id))
}

export function compareBody(records, beforeId, afterId) {
  const before=records.find(r=>r.id===beforeId)||records[0],after=records.find(r=>r.id===afterId)||records.at(-1)
  const comparable=!!before&&!!after&&before.id!==after.id&&before.d<=after.d
  const metrics=MEASURE_FIELDS.map(([key,label])=>{
    const first=before?.values[key]??null,last=after?.values[key]??null
    const delta=comparable&&first!=null&&last!=null?last-first:null
    return {key,label,unit:after?.unit||before?.unit||'cm',first,last,delta,percent:delta!=null&&first>0?delta/first*100:null}
  }).filter(m=>m.first!=null||m.last!=null)
  const changed=metrics.filter(m=>m.delta!=null),threshold=after?.unit==='in'?0.1/CM_PER_IN:0.1
  return {before,after,metrics,count:records.length,days:comparable?Math.round((Date.parse(after.d)-Date.parse(before.d))/86400000):null,
    increase:changed.filter(m=>m.delta>=threshold).sort((a,b)=>b.delta-a.delta)[0],
    decrease:changed.filter(m=>m.delta<=-threshold).sort((a,b)=>a.delta-b.delta)[0],
    stable:changed.filter(m=>Math.abs(m.delta)<threshold),threshold}
}
