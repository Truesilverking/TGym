import { isoOf } from './format.js'
import { validDate } from './training-history.js'
import { dayNumber } from './training-pause.js'
import { loggedWorkouts, consistencyStats } from './consistency.js'
import { MEASURE_FIELDS, measurementValue, validTimedSessions } from './stats-insights.js'
import { displayReps, isBw, modeOf } from './history.js'
import { isWarmupRow, modeForSet, setType, extraVolumeOf, dropsOf } from './workout-model.js'
import { estimate1RM } from './onerm.js'
import { rirOf } from './effort.js'
import { EXIDX } from './exercises.js'
import { musclesOf, MUSCLE_NAME } from './muscles.js'
import { activityEntries, activityType } from './activities.js'
import { LB_PER_KG, CM_PER_IN } from './unit-conversion.js'

export const PROGRESS_PERIODS = [['all','Since Start'],['1','1 Month'],['3','3 Months'],['6','6 Months'],['12','1 Year'],['custom','Custom Range']]
export const INBODY_METRICS = [
  ['weight','InBody weight','kg'],['skeletalMuscle','Skeletal muscle mass','kg'],['bodyFatMass','Body fat mass','kg'],
  ['bodyFatPct','Body fat percentage','%'],['bmi','BMI',''],['visceralFat','Visceral fat level',''],
  ['bodyWater','Total body water','L'],['protein','Protein','kg'],['minerals','Minerals','kg'],['bmr','Basal metabolic rate','kcal'],['score','InBody score',''],
]
const number = v => v == null || v === '' || typeof v === 'boolean' || !Number.isFinite(Number(v)) ? null : Number(v)
const positive = v => number(v) > 0 ? Number(v) : null
const sum = list => list.reduce((a,b)=>a+b,0)
const avg = list => list.length ? sum(list)/list.length : null
const point = (row,y) => { const time=number(row.t)??number(row.start);return {d:row.d,t:time!=null&&Number.isFinite(new Date(time).getTime())&&isoOf(new Date(time))===row.d?time:new Date(row.d+'T12:00:00').getTime(),y} }
const load = (v,from,to) => number(v) == null ? null : Number(v)*(from===to?1:from==='lb'?1/LB_PER_KG:LB_PER_KG)
const length = (v,from,to) => number(v) == null ? null : Number(v)*(from===to?1:from==='in'?CM_PER_IN:1/CM_PER_IN)
const performanceScore = row => row.mode==='time' ? row.sec||0 : row.mode==='cardio' ? row.min||0 : row.est??row.w??0
const addDays = (d,n) => { const value=new Date(d+'T12:00:00');value.setDate(value.getDate()+n);return isoOf(value) }

export function progressRange(S, {period='all',from,to,now=new Date()}={}) {
  const today=isoOf(now)
  const earliest=[...(S.workouts||[]),...(S.bodyweight||[]),...(S.measurements||[]),...(S.inbody||[]),...(S.heightHistory||[]),{d:S.heightRecordedAt}].map(r=>r.d).filter(d=>validDate(d)&&d<=today).sort()[0] || today
  const boundary=validDate(S.trainingStartDate)?S.trainingStartDate:earliest
  let start=boundary,end=today
  if(period==='custom') {
    if(!validDate(from)||!validDate(to)||from>to||from>today) return {error:'Choose a valid date range.'}
    start=from;end=to<today?to:today
  } else if(['1','3','6','12'].includes(period)) {
    const d=new Date(today+'T12:00:00'),day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()-Number(period));d.setDate(Math.min(day,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));start=isoOf(d)
  }
  start=start<boundary?boundary:start
  return start>end?{error:'No data in this period.'}:{start,end,today}
}

// Neutral, objective change. Percentages are omitted for effort/scales and zero baselines.
export function progressMetric(key,label,unit,values,{percent=true}={}) {
  const seen=new Set(),points=values.filter(p=>validDate(p.d)&&Number.isFinite(p.t)&&number(p.y)!=null).sort((a,b)=>a.t-b.t).filter(p=>{const k=p.t+':'+p.y;if(seen.has(k))return false;seen.add(k);return true})
  const first=points[0],last=points.at(-1),enough=points.length>1&&last.t>first.t
  const delta=enough?last.y-first.y:null,ratio=percent&&enough&&first.y!==0?delta/Math.abs(first.y)*100:null
  // Least-squares slope over real elapsed days, not array positions.
  const xs=points.map(p=>(p.t-(first?.t||0))/86400000),mx=avg(xs),my=avg(points.map(p=>p.y)),den=sum(xs.map(x=>(x-mx)**2))
  const slope=enough&&den>0?sum(points.map((p,i)=>(xs[i]-mx)*(p.y-my)))/den:null
  return {key,label,unit,deltaUnit:unit==='%'?'percentage points':unit,points,first,last,delta,percent:Number.isFinite(ratio)?ratio:null,days:enough?(last.t-first.t)/86400000:null,slope,status:!enough?'Insufficient Data':Math.abs(delta)<1e-8?'Stable':'Changed'}
}

export function comparePerformance(a,b) {
  if(!a||!b)return 'Insufficient Data'
  if([a.w,b.w,a.r,b.r].some(v=>number(v)==null))return 'Insufficient Data'
  // Only a matched prescription family may reach this function. Unknown effort
  // does not establish equal effort; an estimate alone is not proof of improvement.
  if(a.rir!=null&&b.rir!=null&&b.w>=a.w&&b.r>=a.r&&b.rir>=a.rir&&(b.w>a.w||b.r>a.r||b.rir>a.rir)) return 'Improved'
  return a.w===b.w&&a.r===b.r&&a.rir===b.rir?'Stable':'Changed'
}

export function buildProgressReport(S, options={}) {
  const range=progressRange(S,options)
  if(range.error)return {range,body:[],exercises:[],training:[],activities:[],records:[],highlights:[]}
  const {start,end,today}=range,inside=d=>validDate(d)&&d>=start&&d<=end
  const unit=S.unit==='lb'?'lb':'kg',measureUnit=S.measurementUnit==='in'?'in':'cm'
  const metric=(key,label,u,pts,opts)=>progressMetric(key,label,u,pts.filter(p=>inside(p.d)),opts)
  const body=[]
  const bw=(S.bodyweight||[]).flatMap(r=>Array.isArray(r.samples)&&r.samples.length?r.samples.map(s=>({...s,d:r.d,unit:r.unit})):r)
  body.push(metric('weight','Body Weight',unit,bw.filter(r=>positive(r.w)).map(r=>point(r,load(r.w,r.unit||unit,unit)))))
  for(const [key,label] of MEASURE_FIELDS) body.push(metric(key,label,measureUnit,(S.measurements||[]).filter(r=>measurementValue(r,key)>0).map(r=>point(r,length(measurementValue(r,key),r.unit||measureUnit,measureUnit)))))
  const heights=[...(S.heightHistory||[])]
  if(!heights.length&&positive(S.heightCm)&&validDate(S.heightRecordedAt))heights.push({d:S.heightRecordedAt,cm:length(S.heightCm,measureUnit,'cm')})
  body.push(metric('height','Height',measureUnit,heights.filter(r=>positive(r.cm)).map(r=>point(r,length(r.cm,'cm',measureUnit)))))
  for(const [key,label,u] of INBODY_METRICS)body.push(metric('inbody:'+key,label,u==='kg'?unit:u,(S.inbody||[]).filter(r=>positive(r[key])).map(r=>point(r,u==='kg'?load(r[key],'kg',unit):Number(r[key]))),{percent:!['bodyFatPct','score','visceralFat','bmi'].includes(key)}))
  // BMI uses the height known on that date. Never apply today's new height backwards.
  const heightTimeline=heights.filter(r=>validDate(r.d)&&positive(r.cm)).sort((a,b)=>a.d.localeCompare(b.d))
  body.push(metric('derived-bmi','BMI from recorded height','',bw.flatMap(r=>{const h=heightTimeline.filter(h=>h.d<=r.d).at(-1);return h&&positive(r.w)?[point(r,load(r.w,r.unit||unit,'kg')/(h.cm/100)**2)]:[]}),{percent:false}))

  const seen=new Set()
  const all=loggedWorkouts(S).filter(w=>validDate(w.d)&&w.d<=end&&(!S.trainingStartDate||w.d>=S.trainingStartDate)).filter(w=>{const k=w.id??JSON.stringify([w.d,w.start,w.end,w.entries]);if(seen.has(k))return false;seen.add(k);return true}).sort((a,b)=>a.d.localeCompare(b.d)||(a.start||0)-(b.start||0))
  const workouts=all.filter(w=>inside(w.d)),groups=new Map(),sessions=[],records=[],activityGroups=new Map(),muscleGroups=new Map()
  for(const w of all) {
    let sets=0,reps=0,volume=0
    for(const e of w.entries||[]) {
      const cfg={id:e.id,...e.target},ex=e.exercise||EXIDX[e.id]||(S.customEx||[]).find(x=>x.id===e.id)||{id:e.id,n:e.n||e.id}
      cfg.mode=modeOf(cfg)
      const grouped=new Map()
      for(const s of e.sets||[]) {
        if(!s.done||isWarmupRow(s))continue
        const mode=modeForSet(s,cfg),type=setType(s),role=s.role||'work',side=!!cfg.side,bwMode=isBw(cfg)
        const key=JSON.stringify([e.id,mode,type,role,side,bwMode])
        const rawWeight=load(s.w,s.unit||w.unit||unit,unit),weight=rawWeight!=null&&rawWeight>=0?rawWeight:null,r=number(displayReps(s.r,cfg)),rir=number(rirOf(s))
        const row={w:weight,r,rir:rir!=null&&rir>=0&&rir<=10?rir:null,sec:positive(s.sec),min:positive(s.min),speed:number(s.speed),mode}
        row.est=mode==='reps'&&type==='straight'&&!bwMode?estimate1RM(weight,r):null
        const rawReps=number(s.r),validReps=mode==='reps'&&rawReps>0&&r>0,validTime=mode==='time'&&row.sec>0||mode==='cardio'&&row.min>0
        if(!validReps&&!validTime)continue
        row.volume=validReps&&weight>=0?load((number(s.w)||0)*rawReps+extraVolumeOf({...s,drops:dropsOf(s).filter(d=>number(d.w)>=0&&positive(d.r))}),s.unit||w.unit||unit,unit):0
        row.totalReps=validReps?rawReps+sum(dropsOf(s).map(d=>positive(d.r)||0)):0
        sets++;reps+=row.totalReps;volume+=row.volume
        if(!grouped.has(key))grouped.set(key,{rows:[],key,id:e.id,exercise:ex,mode,type,role,side,bwMode})
        grouped.get(key).rows.push(row)
        if(inside(w.d))for(const [slug,factor] of Object.entries(musclesOf(ex))) {
          if(!muscleGroups.has(slug))muscleGroups.set(slug,[])
          muscleGroups.get(slug).push({...point(w,row.volume*factor),sets:factor})
        }
      }
      for(const [key,g] of grouped) {
        if(!groups.has(key))groups.set(key,{...g,rows:undefined,sessions:[]})
        // Same family only. One representative actual set, never independently
        // combine max weight/reps/RIR from different sets into a fictional set.
        const best=[...g.rows].sort((a,b)=>performanceScore(b)-performanceScore(a)||(b.r||0)-(a.r||0))[0]
        groups.get(key).sessions.push({...point(w,0),id:w.id, best,sets:g.rows.length,reps:sum(g.rows.map(r=>r.totalReps)),volume:sum(g.rows.map(r=>r.volume))})
      }
    }
    if(inside(w.d)) {
      sessions.push({...point(w,0),sets,reps,volume})
      for(const a of activityEntries(w)) {
        if(!activityGroups.has(a.type))activityGroups.set(a.type,[])
        activityGroups.get(a.type).push({...a,...point(w,0)})
      }
    }
  }
  const exercises=[]
  for(const group of groups.values()) {
    // Entries repeated within a workout are one session, and one potential PR.
    const merged=new Map()
    for(const s of group.sessions) {const k=s.id??s.t;const previous=merged.get(k);if(!previous)merged.set(k,{...s});else {previous.sets+=s.sets;previous.reps+=s.reps;previous.volume+=s.volume;if(performanceScore(s.best)>performanceScore(previous.best))previous.best=s.best}}
    const history=[...merged.values()],recent=history.filter(s=>inside(s.d));if(!recent.length)continue
    const metrics=[]
    const defs=group.mode==='reps'?[['w','Load',unit],['r','Reps',group.side?'reps / side':'reps'],['rir','RIR',''],['est','Estimated 1RM',unit]]:group.mode==='time'?[['sec','Work duration','s'],['w','Load',unit]]:[['min','Work duration','min'],['speed','Speed','km/h']]
    for(const [key,label,u] of defs)metrics.push(metric(key,label,u,recent.filter(s=>number(s.best[key])!=null).map(s=>({...s,y:s.best[key]})),{percent:key!=='rir'}))
    for(const [key,label,u] of [['sets','Sets',''],['reps','Total reps',''],['volume','Training volume',unit]])if(group.mode==='reps'||key==='sets')metrics.push(metric(key,label,u,recent.map(s=>({...s,y:s[key]}))))
    const recordChannels=new Map()
    for(const s of history) {
      const repRecord=group.mode==='reps'&&s.best.est==null&&group.type==='straight'&&(group.bwMode||s.best.w!=null)
      const value=group.mode==='reps'?(repRecord?s.best.r:s.best.est):group.mode==='time'?s.best.sec:s.best.min
      if(value==null)continue
      const channel=repRecord?'reps:'+s.best.w:'primary',bestRecord=recordChannels.get(channel)
      if(bestRecord!=null&&value>bestRecord&&inside(s.d))records.push({key:group.key+':'+s.t,exercise:group.exercise,d:s.d,t:s.t,value,previous:bestRecord,w:s.best.w,r:s.best.r,label:repRecord?'Reps at the same load':group.mode==='reps'?'Estimated 1RM':'Work duration',unit:repRecord?'reps':group.mode==='reps'?unit:group.mode==='time'?'s':'min'})
      recordChannels.set(channel,Math.max(bestRecord??0,value))
    }
    exercises.push({...group,sessions:recent,records:records.filter(r=>r.key.startsWith(group.key+':')),metrics:metrics.filter(m=>m.points.length),status:recent.length<2?'Insufficient Data':group.mode==='reps'?comparePerformance(recent[0].best,recent.at(-1).best):'Changed'})
  }
  const dates=[...new Set(workouts.map(w=>w.d))].sort(),timed=validTimedSessions(workouts,{activeId:S.active?.id,now:new Date(options.now||Date.now()).getTime()}),days=dayNumber(end)-dayNumber(start)+1
  let longest=0,run=0,previous=null
  for(const d of dates){run=previous&&dayNumber(d)-dayNumber(previous)===1?run+1:1;longest=Math.max(longest,run);previous=d}
  const current=dates.at(-1)>=addDays(end,-1)?run:0
  const weekly=[]
  let monday=new Date(start+'T12:00:00');monday.setDate(monday.getDate()-(monday.getDay()+6)%7)
  const byWeek=new Map()
  for(const s of sessions){const d=new Date(s.d+'T12:00:00');d.setDate(d.getDate()-(d.getDay()+6)%7);const k=isoOf(d);if(!byWeek.has(k))byWeek.set(k,[]);byWeek.get(k).push(s)}
  for(let d=isoOf(monday);d<=end;d=addDays(d,7)){
    const rows=byWeek.get(d)||[],finish=addDays(d,6)
    weekly.push({...point({d},0),end:finish,partial:d<start||finish>end||finish>=today,workouts:rows.length,sets:sum(rows.map(s=>s.sets)),reps:sum(rows.map(s=>s.reps)),volume:sum(rows.map(s=>s.volume))})
  }
  const training=[metric('session-volume','Volume per workout',unit,sessions.map(s=>({...s,y:s.volume}))),metric('duration','Workout duration','min',timed.map(w=>point(w,w.durationMs/60000)))]
  for(const [key,label,u] of [['volume','Weekly volume',unit],['sets','Weekly sets',''],['reps','Weekly reps',''],['workouts','Workouts per week','']])training.push(progressMetric(key,label,u,weekly.filter(w=>!w.partial).map(w=>({...w,y:w[key]}))))
  for(const [slug,rows] of muscleGroups){const grouped=new Map();for(const p of rows)grouped.set(p.d,(grouped.get(p.d)||0)+p.y);training.push(metric('muscle:'+slug,'Muscle volume: {0}',unit,[...grouped].map(([d,y])=>point({d},y))));training.at(-1).muscle=MUSCLE_NAME[slug]||slug}
  const activities=[]
  for(const [type,rows] of activityGroups)for(const [key,label,u] of [['minutes','Work duration','min'],['distanceKm','Distance','km'],['averageHeartRate','Average heart rate','bpm'],['calories','Calories','kcal'],['steps','Steps',''],['elevationM','Elevation','m'],['hrZone','Heart rate zone',''],['rpe','RPE','']]){
    const m=metric(type+':'+key,label,u,rows.filter(r=>number(r[key])!=null).map(r=>({...r,y:r[key]})),{percent:!['rpe','hrZone','averageHeartRate'].includes(key)});if(m.points.length)activities.push({...m,activity:activityType(type).label})
  }
  const consistency=consistencyStats({...S,workouts},start,end,new Date(today+'T12:00:00'))
  const summary={workouts:workouts.length,activeDays:dates.length,averagePerWeek:workouts.length/(days/7),longestStreak:longest,currentStreak:current,totalMinutes:sum(timed.map(w=>w.durationMs))/60000,averageMinutes:avg(timed.map(w=>w.durationMs/60000)),timedSessions:timed.length,sets:sum(sessions.map(s=>s.sets)),reps:sum(sessions.map(s=>s.reps)),volume:sum(sessions.map(s=>s.volume)),averageVolume:avg(sessions.map(s=>s.volume)),...consistency}
  const visibleBody=body.filter(m=>m.points.length),highlights=[...visibleBody,...exercises.flatMap(e=>e.metrics.filter(m=>m.key==='w').map(m=>({...m,exercise:e.exercise})))].filter(m=>m.delta!=null&&Math.abs(m.delta)>1e-8).sort((a,b)=>Math.abs(b.percent||0)-Math.abs(a.percent||0)).slice(0,4)
  return {range,unit,measureUnit,body:visibleBody,exercises,training:workouts.length?training.filter(m=>m.points.length):[],activities,records:records.sort((a,b)=>b.t-a.t),highlights,summary,weekly}
}
