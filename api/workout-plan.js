import { isTrainingPaused } from './training-pause.js'
// The API ships independently of the frontend; preserve the same ordered-plan semantics.
export function nextRoutineId(S, iso) {
  if (isTrainingPaused(S,iso) || S.scheduleStarted && iso < S.scheduleStarted) return null
  const value=S.dayPlan?.[iso] ?? S.week?.[new Date(iso+'T12:00:00').getDay()]
  const ids=[...new Set((Array.isArray(value)?value:value && value!=='rest'?[value]:[]))]
  const matched=new Set(),seen=new Set()
  const workouts=(S.workouts || []).filter(w=>{
    if(!w || w.d!==iso || w.active || w.cancelled || w.canceled || w.id!=null && w.id===S.active?.id || ['active','cancelled','canceled'].includes(w.status) || ['cancelled','canceled'].includes(w.finishReason))return false
    if(w.id!=null){if(seen.has(w.id))return false;seen.add(w.id)}
    return true
  })
  for(const id of ids){
    const r=S.routines?.find(r=>r.id===id)
    if(!r || r.scheduledFrom && iso<r.scheduledFrom)continue
    const w=workouts.find(w=>!matched.has(w) && (w.routineId===id || !w.routineId && w.name===r.name))
    if(w){matched.add(w);continue}
    if(!S.daySkipped?.[iso]?.includes(id))return id
  }
  return null
}
