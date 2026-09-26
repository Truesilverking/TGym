import { buildProgressReport } from './progress-report.js'
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
function sections(report,t,name) {
 const q=report.summary
 if(!q)return []
 return [
  {title:t('Your progress'),lines:[...Object.entries({ 'Total workouts':q.workouts,'Active days':q.activeDays,'Average workouts per week':q.averagePerWeek,'Total time (min)':q.timedSessions?q.totalMinutes:null,'Average duration (min)':q.averageMinutes,'Scheduled':q.planned,'Completed':q.completed,'Missed':q.missed,'Completion':q.rate==null?null:q.rate*100,'Longest active-day streak':q.longestStreak,'Current active-day streak':q.currentStreak,'Personal Records':report.records.length}).map(([label,value])=>({label:t(label),value})),...report.highlights.map(m=>({label:(m.exercise?name(m.exercise):t(m.label))+' · '+t('Change'),value:m.delta,unit:m.deltaUnit}))]},
  {title:t('Body Progress'),metrics:report.body},...report.exercises.map(e=>({title:t('Exercise Progress')+' · '+name(e.exercise)+' · '+t(e.mode)+' / '+t(e.type)+' / '+t(e.role)+(e.side?' / '+t('/ side'):''),metrics:e.metrics,lines:[{label:t('Sessions'),value:e.sessions.length},{label:t('Personal Records'),value:e.records.length}]})),
  {title:t('Training volume'),metrics:report.training}, {title:t('Activity Progress'),metrics:report.activities.map(m=>({...m,label:t(m.activity)+' · '+t(m.label)}))},
  {title:t('Personal Records'),lines:report.records.map(p=>({label:name(p.exercise)+' · '+p.d+' · '+t(p.label),value:p.value,unit:p.unit,previous:p.previous}))},
 ]
}
const spark = (m,x,y,w,h) => {
 if(m.points.length<2)return ''
 const values=m.points.map(p=>p.y),min=Math.min(...values),max=Math.max(...values),first=m.points[0].t,span=m.points.at(-1).t-first||1
 const stride=Math.max(1,Math.ceil(m.points.length/150)),pts=m.points.filter((_,i)=>i%stride===0||i===m.points.length-1)
 return `<polyline fill="none" stroke="#b51e28" stroke-width="2" points="${pts.map(p=>`${x+(p.t-first)/span*w},${y+h-(p.y-min)/(max-min||1)*h}`).join(' ')}"/>`
}
export function progressReportHTML(report,{t=x=>x,exerciseNameFor=e=>e.n||e.id,fmtNum=n=>Number(n.toFixed(1)).toLocaleString(),fmtDate=d=>d,fragment=false}={}) {
 const val=(n,u='')=>n==null?'—':esc(fmtNum(n)+' '+t(u))
 let body=`<section class="progress-export"><h1>${esc(t('Progress Report'))}</h1><p>${esc(report.range.start)} → ${esc(report.range.end)}</p><p>${esc(t('Only recorded data. Changes are not automatically improvements.'))}</p>`
 for(const section of sections(report,t,exerciseNameFor)) {
  body+=`<h2>${esc(section.title)}</h2>`
  for(const l of section.lines||[])body+=`<p>${esc(l.label)}: <b>${l.previous!=null?val(l.previous,l.unit)+' → ':''}${val(l.value,l.unit)}</b></p>`
  for(const m of section.metrics||[])body+=`<article><h3>${esc(m.muscle?t(m.label,t(m.muscle)):t(m.label))}</h3><p>${val(m.first?.y,m.unit)} → <b>${val(m.last?.y,m.unit)}</b></p><p>${esc(fmtDate(m.first?.d,false,true))} → ${esc(fmtDate(m.last?.d,false,true))}</p><p>${m.delta==null?esc(t('More data needed')):val(m.delta,m.deltaUnit)+(m.percent==null?'':' · '+val(m.percent,'%'))}</p><svg viewBox="0 0 600 90" role="img" aria-label="${esc(t('Trend'))}">${spark(m,3,3,590,80)}</svg></article>`
 }
 body+='</section>'
 return fragment?body:`<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(t('Progress Report'))}</title><style>body{font:16px system-ui;margin:24px;max-width:1000px;color:#18202c}h1{color:#b51e28}article{border:1px solid #ccd1d8;border-radius:12px;padding:16px;margin:12px 0;break-inside:avoid}svg{width:100%;max-height:100px}h2,h3,p{overflow-wrap:anywhere}@media print{body{margin:0}h2{break-after:avoid}}</style>${body}</html>`
}
// Same calculations as the interactive module; complete report appends paginated
// vector cards so charts and long histories never rely on viewport screenshots.
export function progressReportPages(S,{t=x=>x,now=new Date(),name=e=>e.n||e.id,formatNumber=n=>Number(n.toFixed(1)).toLocaleString()}={}) {
 const report=buildProgressReport(S,{now}),cards=[]
 for(const section of sections(report,t,name)) {
  for(const l of section.lines||[])cards.push({title:section.title,label:l.label,value:l.value==null?'—':formatNumber(l.value)+' '+(l.unit||'')})
  for(const m of section.metrics||[])cards.push({title:section.title,label:m.muscle?t(m.label,t(m.muscle)):t(m.label),value:`${formatNumber(m.first.y)} → ${formatNumber(m.last.y)} ${t(m.unit)}`,detail:m.delta==null?t('More data needed'):`${formatNumber(m.delta)} ${t(m.deltaUnit)}${m.percent==null?'':' · '+formatNumber(m.percent)+'%'}`,dates:`${m.first.d} → ${m.last.d}`,metric:m})
 }
 const pages=[]
 if(!cards.length)cards.push({title:t('Progress Report'),label:t('No comparable history in this period.'),value:''})
 for(let i=0;i<cards.length;i+=6) {
  const text=(x,y,s,size=19)=>`<text x="${x}" y="${y}" font-size="${size}" fill="#18202c">${esc(s)}</text>`
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1390"><rect width="1000" height="1390" fill="white"/><g font-family="Arial,sans-serif">${text(48,60,t('Progress Report'),32)}${text(48,98,report.range.start+' → '+report.range.end)}`
  cards.slice(i,i+6).forEach((c,j)=>{const y=140+j*195;const title=c.title.length>75?c.title.slice(0,72)+'…':c.title;svg+=`<rect x="48" y="${y}" width="904" height="180" rx="12" fill="#f3f5f8"/>`+text(64,y+27,title,17)+text(64,y+57,c.label.length>80?c.label.slice(0,77)+'...':c.label,19)+text(64,y+92,c.value,26)+text(64,y+125,c.detail||'',19)+text(64,y+156,c.dates||'',16);if(c.metric)svg+=spark(c.metric,650,y+75,270,65)})
  pages.push({svg:svg+'</g></svg>',width:1000,height:1390})
 }
 return pages
}
