import { routineIds, dailyPlan } from './daily-plan.js'
import { dayNumber } from './training-pause.js'
import { loggedWorkouts } from './consistency.js'
import { isoOf, uid } from './format.js'
import { workoutElapsedMs } from './workout-time.js'

export const ACTIVITY_TYPES = [
  { id:'running', label:'Running', distance:true, steps:true, elevation:true },
  { id:'walking', label:'Walking', distance:true, steps:true, elevation:true },
  { id:'cycling', label:'Cycling', distance:true, elevation:true },
  { id:'hiking', label:'Hiking', distance:true, steps:true, elevation:true },
  { id:'cardio', label:'Cardio', distance:true },
  { id:'strength', label:'Strength activity' }, { id:'mobility', label:'Mobility' }, { id:'recovery', label:'Recovery' }, { id:'other', label:'Other activity' },
]
export const activityType = id => ACTIVITY_TYPES.find(a => a.id === id) || ACTIVITY_TYPES.at(-1)
export const activityExerciseId = type => `tgym_activity_${activityType(type).id}`
export function activityConfig(type, minutes = 30) {
  return { id:activityExerciseId(type), activityType:activityType(type).id, mode:activityType(type).distance ? 'cardio' : 'time', sets:1, min:minutes, sec:minutes*60, speed:0, rest:0, prog:'off' }
}
export function ensureActivityExercise(S, type, label) {
  const kind = activityType(type), id = activityExerciseId(type)
  S.customEx ||= []
  if (!S.customEx.some(e => e.id === id)) S.customEx.push({id,n:label || kind.label,bp:'cardio',tg:'cardiovascular system',eq:'body weight',sm:[],primaries:[],secondaries:[],activityType:kind.id,custom:true})
  return id
}
export function addActivityRoutine(S, type, minutes, name) {
  ensureActivityExercise(S, type, name)
  S.routines ||= []
  const routine = {id:uid(),name:name || activityType(type).label,emoji:'figureRun',ex:[activityConfig(type,minutes)]}
  S.routines.push(routine)
  return routine.id
}
export function attachActivity(S, routineId, type, minutes) {
  const routine = S.routines.find(r => r.id === routineId)
  if (!routine) throw new Error('Routine no longer exists')
  ensureActivityExercise(S,type)
  if (routine.ex.some(e => e.id === activityExerciseId(type))) throw new Error('Activity already belongs to this routine')
  routine.ex.push(activityConfig(type,minutes))
}
const numeric = (value, min, max) => {
  if (value == null || value === '') return null
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') throw new Error('Invalid activity value')
  const n = Number(value)
  if (!Number.isFinite(n) || n < min || n > max) throw new Error('Invalid activity value')
  return n
}
export function createActivityWorkout(S, input, now = Date.now()) {
  const type = activityType(input.type), start = Number(input.start)
  const minutes = numeric(input.minutes, .1, 1440)
  if (!Number.isFinite(start) || start <= 0 || minutes == null || start + minutes * 60000 > now + 60000) throw new Error('Invalid activity date or duration')
  const metrics = {type:type.id,source:input.source || 'manual',sourceId:input.sourceId || null,
    distanceKm:type.distance ? numeric(input.distanceKm,0,2000) : null,
    averageHeartRate:numeric(input.averageHeartRate,25,250),calories:numeric(input.calories,0,30000),
    steps:type.steps ? numeric(input.steps,0,300000) : null,elevationM:type.elevation ? numeric(input.elevationM,0,20000) : null,
    hrZone:numeric(input.hrZone,1,5),rpe:numeric(input.rpe,1,10),sourceUpdatedAt:input.sourceUpdatedAt || null}
  const id = ensureActivityExercise(S,type.id,input.name), cfg = activityConfig(type.id,minutes), end = start + minutes * 60000
  const scheduled = input.routineId || dailyPlan(S,isoOf(new Date(start))).pending.find(item=>item.routine.ex.length===1 && item.routine.ex[0].activityType===type.id)?.id
  const routine = S.routines.find(r => r.id === scheduled && r.ex.length === 1 && r.ex[0].activityType === type.id)
  return {id:input.id || uid(),d:isoOf(new Date(start)),name:input.name || type.label,start,end,entries:[{id,target:cfg,exercise:S.customEx.find(e=>e.id===id),sets:[{done:true,doneAt:end,min:minutes,sec:minutes*60,speed:metrics.distanceKm ? metrics.distanceKm/minutes*60 : 0,distanceKm:metrics.distanceKm}]}],routineId:routine?.id || null,unit:S.unit,vol:0,kind:'activity',activity:metrics,note:String(input.note || '').slice(0,2000)}
}
export function activityEntries(workout) {
  if (workout.activity) return [{...workout.activity,minutes:workoutElapsedMs(workout)/60000}]
  return (workout.entries || []).filter(e => e.target?.activityType || e.exercise?.activityType || e.target?.mode === 'cardio').map(e => {
    const sets=(e.sets || []).filter(s=>s.done && !s.warmup)
    return {type:e.target?.activityType || e.exercise?.activityType || 'cardio',minutes:sets.reduce((sum,s)=>sum+(e.target?.mode==='time' ? (s.sec || 0)/60 : (s.min || 0)),0),distanceKm:sets.reduce((sum,s)=>sum+(s.distanceKm ?? ((s.min || 0)*(s.speed || 0)/60)),0),source:'manual'}
  }).filter(e=>e.minutes>0)
}
export function hybridSummary(workouts) {
  const rows=loggedWorkouts({workouts})
  const out={strength:0,running:0,cardio:0,recovery:0,days:new Set(),minutes:0,distanceKm:0,load:0,ratedActivities:0}
  for (const w of rows) {
    out.days.add(w.d);out.minutes+=Number(w.start)>0 && Number(w.end)>Number(w.start) ? workoutElapsedMs(w)/60000 : 0
    const activities=activityEntries(w)
    if (!activities.some(a=>a.type==='strength') && (!activities.length || (w.entries || []).some(e=>!e.target?.activityType && !e.exercise?.activityType && e.target?.mode!=='cardio'))) out.strength++
    for (const a of activities) {
      out[a.type==='strength'?'strength':a.type==='running'?'running':['mobility','recovery'].includes(a.type)?'recovery':'cardio']++
      out.distanceKm+=a.distanceKm || 0
      if(a.rpe!=null){out.load+=a.minutes*a.rpe;out.ratedActivities++}
    }
  }
  return {...out,days:out.days.size,sessions:rows.length}
}
// Stable source IDs handle updates. Near-identical manual/provider records are
// reconciled, with manual notes and routine assignment retained, never double counted.
export function mergeImportedActivities(S, records, source='health-connect', now=Date.now()) {
  if (!Array.isArray(records) || records.length>5000) throw new Error('Invalid activity import')
  let added=0,updated=0,skipped=0
  for (const record of records) {
    if (!record || typeof record !== 'object' || Array.isArray(record) || !record.id || !Number.isFinite(Number(record.start)) || !Number.isFinite(Number(record.end)) || record.end<=record.start) {skipped++;continue}
    const key=`${source}:${record.origin || ''}:${record.id}`
    const exact=S.workouts.find(w=>w.activity?.sourceId===key || w.activity?.sourceIds?.includes(key))
    const minutes=(record.end-record.start)/60000
    const duplicate=exact || S.workouts.find(w=>(w.activity?.type===activityType(record.type).id || (!w.activity && ((w.entries?.length===1 && activityEntries(w)[0]?.type===activityType(record.type).id) || (record.type==='strength' && w.entries?.length>0 && !activityEntries(w).length)))) && Math.abs(w.start-record.start)<=120000 && Math.abs(workoutElapsedMs(w)-(record.end-record.start))<=Math.max(60000,(record.end-record.start)*.03))
    if (exact && exact.activity.sourceUpdatedAt && record.updatedAt && Number(record.updatedAt)<=Number(exact.activity.sourceUpdatedAt)) {skipped++;continue}
    let incoming
    try { incoming=createActivityWorkout(S,{...duplicate?.activity,...Object.fromEntries(Object.entries(record).filter(([,v])=>v!=null)),minutes,source,sourceId:key,sourceUpdatedAt:record.updatedAt,id:duplicate?.id,routineId:duplicate?.routineId,note:duplicate?.note || record.note},now) } catch {skipped++;continue}
    if(duplicate && (!duplicate.activity || duplicate.activity.preservesWorkout)) incoming={...incoming,...duplicate,activity:{...incoming.activity,preservesWorkout:true}}
    if(duplicate){incoming.activity.sourceIds=[...new Set([...(duplicate.activity?.sourceIds || []),duplicate.activity?.sourceId,key].filter(Boolean))];incoming.activity.originalSource=duplicate.activity?.originalSource || duplicate.activity?.source;S.workouts[S.workouts.indexOf(duplicate)]=incoming;updated++}
    else {S.workouts.push(incoming);added++}
  }
  S.workouts.sort((a,b)=>(a.start || 0)-(b.start || 0))
  return {added,updated,skipped}
}

export function planActivity(S, {type, minutes, routineId, date, weekdays = [], name}, now = new Date()) {
  if (!(Number(minutes) >= 1 && Number(minutes) <= 1440)) throw new Error('Invalid activity date or duration')
  if (routineId) { attachActivity(S,routineId,type,Number(minutes)); return routineId }
  if (!date && !weekdays.length) throw new Error('Choose a date or weekdays')
  if (date && (!Number.isFinite(dayNumber(date)) || date < isoOf(now))) throw new Error('Choose a date or weekdays')
  if (weekdays.some(d=>!Number.isInteger(d) || d<0 || d>6)) throw new Error('Choose a date or weekdays')
  const id = addActivityRoutine(S,type,Number(minutes),name)
  S.routines.find(r=>r.id===id).scheduledFrom=isoOf(now)
  if (date) { S.dayPlan ||= {}; S.dayPlan[date]=[...routineIds(S.dayPlan[date] ?? S.week?.[new Date(date+'T12:00:00').getDay()]),id] }
  else { S.week ||= {}; weekdays.forEach(d=>{S.week[d]=[...routineIds(S.week[d]),id]}) }
  S.scheduleStarted ||= isoOf(now)
  return id
}
export const activityPace = a => a.distanceKm > 0 && a.minutes > 0 ? a.minutes/a.distanceKm : null
