// Local calendar dates, never elapsed milliseconds: pauses must survive DST and travel.
const DAY = 86400000
export const dayNumber = iso => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return NaN
  const n = Date.parse(iso + 'T12:00:00Z')
  return Number.isFinite(n) && new Date(n).toISOString().slice(0,10) === iso ? Math.floor(n / DAY) : NaN
}
export const dayISO = n => new Date(n * DAY).toISOString().slice(0,10)
export function pauseRanges(S) {
  const ranges = (Array.isArray(S.trainingPauses) ? S.trainingPauses : []).map(p=>({start:dayNumber(p?.start),end:p?.end == null ? Infinity : dayNumber(p.end)}))
    .filter(p=>Number.isFinite(p.start) && p.end > p.start).sort((a,b)=>a.start-b.start)
  const merged=[]
  for(const range of ranges) {
    const last=merged.at(-1)
    if(last && range.start<=last.end) last.end=Math.max(last.end,range.end)
    else merged.push({...range})
  }
  return merged
}
export function isTrainingPaused(S, iso) {
  const day=dayNumber(iso)
  return pauseRanges(S).some(p=>p.start<=day && day<p.end)
}
export function openTrainingPause(S) {
  return (Array.isArray(S.trainingPauses) ? S.trainingPauses : []).find(p=>Number.isFinite(dayNumber(p?.start)) && p.end == null) || null
}
export function pausedDaysBetween(S, start, end) {
  const a=dayNumber(start), b=dayNumber(end)
  return pauseRanges(S).reduce((n,p)=>n+Math.max(0,Math.min(b,p.end)-Math.max(a,p.start)),0)
}
// Invert the cycle's active-day clock. An open pause has no promised resumption date.
export function calendarDateForTrainingDay(S, virtualDay, anchor) {
  let real=virtualDay
  for(const p of pauseRanges(S)) {
    const start=Math.max(anchor,p.start)
    if(p.end<=anchor || start>real) continue
    if(!Number.isFinite(p.end)) return null
    real+=p.end-start
  }
  return dayISO(real)
}
export function pauseTraining(S, today, id) {
  if(S.active) throw new Error('active-workout')
  if(!Number.isFinite(dayNumber(today))) throw new Error('invalid-date')
  if(openTrainingPause(S)) return S.trainingPauses
  // Keep today's already-recorded achievement. The next day is the first paused date.
  const completed=(S.workouts || []).some(w=>w.d===today && !w.active && !w.cancelled && !w.canceled && !['active','cancelled','canceled'].includes(w.status) && !['cancelled','canceled'].includes(w.finishReason))
  const start=dayISO(dayNumber(today)+(completed?1:0))
  return [...(S.trainingPauses || []),{id,start,end:null}]
}
export function resumeTraining(S, today) {
  if(!Number.isFinite(dayNumber(today))) throw new Error('invalid-date')
  // end is exclusive: training can resume today. Keep zero-day rows as cancellation
  // tombstones so a stale cloud copy cannot resurrect a cancelled pause.
  return (S.trainingPauses || []).map(p=>p.end == null ? {...p,end:today<p.start?p.start:today} : p)
}
