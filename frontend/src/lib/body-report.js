import { MEASURE_FIELDS, measurementValue } from './stats-insights.js'
import { validDate } from './training-history.js'
import { CM_PER_IN } from './unit-conversion.js'

// A read-only projection. Never fill missing measurements from another date.
export function bodyRecords(S, range) {
  const unit=S.measurementUnit==='in'?'in':'cm'
  return (S.measurements||[]).map((row,index)=>({
    id:String(index),d:row.d,unit,
    values:Object.fromEntries(MEASURE_FIELDS.map(([key])=>{
      const n=measurementValue(row,key),from=row.unit||unit
      return [key,Number.isFinite(n)&&n>0?n*(from===unit?1:from==='in'?CM_PER_IN:1/CM_PER_IN):null]
    })),
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

// Neutral anatomical reference, not a prediction of appearance from circumference.
export const BODY_PATH='M150 18 C128 18 126 40 131 54 Q136 65 141 67 L140 78 Q115 80 102 93 L81 151 L65 209 Q63 220 70 223 Q78 225 82 213 L99 171 L111 143 L116 190 Q111 209 111 229 L120 300 L124 365 Q124 378 138 376 L145 293 L150 246 L155 293 L162 376 Q176 378 176 365 L180 300 L189 229 Q189 209 184 190 L189 143 L201 171 L218 213 Q222 225 230 223 Q237 220 235 209 L219 151 L198 93 Q185 80 160 78 L159 67 Q164 65 169 54 C174 40 172 18 150 18 Z'
export const BODY_ZONES={neck:[150,74],shoulders:[182,94],chest:[150,119],waist:[150,167],hips:[150,207],armLeft:[197,139],armRight:[103,139],forearmLeft:[216,185],forearmRight:[84,185],thighLeft:[169,260],thighRight:[131,260],calfLeft:[170,333],calfRight:[130,333]}
