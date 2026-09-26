import { buildProgressReport } from './progress-report.js'
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
function sections(report,t,name) {
 const q=report.summary
 if(!q)return []
 return [
  {title:t('Your progress'),lines:[...Object.entries({ 'Total workouts':q.workouts,'Active days':q.activeDays,'Average workouts per week':q.averagePerWeek,'Total time (min)':q.timedSessions?q.totalMinutes:null,'Average duration (min)':q.averageMinutes,'Scheduled':q.planned,'Completed':q.completed,'Missed':q.missed,'Completion':q.rate==null?null:q.rate*100,'Longest active-day streak':q.longestStreak,'Current active-day streak':q.currentStreak,'Personal Records':report.records.length}).map(([label,value])=>({label:t(label),value,unit:label==='Completion'?'%':''})),...report.highlights.map(m=>({label:(m.exercise?name(m.exercise):t(m.label))+' · '+t('Change'),value:m.delta,unit:m.deltaUnit}))]},
  {title:t('Body Progress'),metrics:report.body},...report.exercises.map(e=>({title:t('Exercise Progress')+' · '+name(e.exercise)+' · '+t(e.mode==='reps'?'Reps':e.mode==='time'?'Time':'Cardio')+' / '+t(e.type)+' / '+t(e.role)+(e.bwMode?' / '+t('Bodyweight'):'')+(e.side?' / '+t('/ side'):''),metrics:e.metrics,lines:[{label:t('Sessions'),value:e.sessions.length},{label:t('Personal Records'),value:e.records.length}]})),
  {title:t('Training volume'),metrics:report.training}, {title:t('Activity Progress'),metrics:report.activities.map(m=>({...m,label:t(m.activity)+' · '+t(m.label)}))},
  {title:t('Personal Records'),lines:report.records.map(p=>({label:name(p.exercise)+' · '+p.d+' · '+t(p.label),value:p.value,unit:p.unit,previous:p.previous,record:p}))},
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
export function wrapProgressText(value, width) {
 const rows=[]
 let line=''
 for(let word of String(value||'').match(/\S+/g)||[]) {
  if(line&&line.length+word.length+1>width){rows.push(line);line=''}
  while(word.length>width){rows.push(word.slice(0,width));word=word.slice(width)}
  if(word)line+=(line?' ':'')+word
 }
 if(line)rows.push(line)
 return rows
}
// Reused by both the selected-period download and the calendar's complete report.
export function progressReportPages(S,{t=x=>x,now=new Date(),name=e=>e.n||e.id,formatNumber=n=>Number(n.toFixed(1)).toLocaleString(),report=buildProgressReport(S,{now})}={}) {
 const cards=[]
 const val=(n,u='')=>n==null?'—':formatNumber(n)+(u?' '+t(u):'')
 const label=m=>m.muscle?t(m.label,t(m.muscle)):t(m.label)
 for(const section of sections(report,t,name).slice(1)) {
  for(const m of section.metrics||[])cards.push({title:section.title,label:label(m),value:val(m.last?.y,m.unit),detail:m.delta==null?t('More data needed'):(m.delta>0?'+':'')+val(m.delta,m.deltaUnit)+(m.percent==null?'':' · '+val(m.percent,'%')),dates:`${m.first.d} → ${m.last.d}`,baseline:t('Baseline')+': '+val(m.first?.y,m.unit),metric:m})
 }
 const q=report.summary
 const overview=[['Total workouts',q?.workouts],['Active days',q?.activeDays],['Personal Records',report.records?.length],['Average workouts per week',q?.averagePerWeek],['Total time (min)',q?.timedSessions?q.totalMinutes:null],['Average duration (min)',q?.averageMinutes],['Scheduled',q?.planned],['Completed',q?.completed],['Missed',q?.missed],['Completion',q?.rate==null?null:q.rate*100,'%'],['Longest active-day streak',q?.longestStreak],['Current active-day streak',q?.currentStreak]]
 const records=report.records||[]
 const pages=[], total=(q?.workouts?1:0)+Math.max(q?.workouts?0:1,Math.ceil(cards.length/8))+Math.ceil(records.length/12)
 const text=(x,y,s,size=20,color='#17212f',weight=400)=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}">${esc(s)}</text>`
 // Wrap instead of truncating exercise names, including unbroken imported names.
 const lines=(x,y,s,size=18,length=40,max=3)=>wrapProgressText(s,length).slice(0,max).map((line,i)=>text(x,y+i*(size+5),line,size)).join('')
 const header=()=>`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1390"><rect width="1000" height="1390" fill="#f8fafc"/><g font-family="Arial,sans-serif"><rect width="1000" height="12" fill="#b51e28"/>${text(48,62,'TGym',22,'#b51e28',700)}${text(48,114,t('Progress Report'),38,'#17212f',700)}${text(48,150,report.range.start+' → '+report.range.end,20,'#536174')}`
 const footer=page=>text(48,1345,'TGym · '+t('Progress Report'),16,'#536174')+text(900,1345,page+' / '+total,16,'#536174')+'</g></svg>'
 let svg=header()+text(48,212,t('Your progress'),26,'#17212f',700)
 overview.forEach(([l,n,u],i)=>{const x=48+(i%3)*306,y=240+Math.floor(i/3)*155;svg+=`<rect x="${x}" y="${y}" width="292" height="139" rx="16" fill="#ffffff" stroke="#dce2e9"/>`+text(x+20,y+52,val(n,u),34,'#17212f',700)+lines(x+20,y+87,t(l),18,23,3)})
 svg+=text(48,920,t('Highlights'),26,'#17212f',700)
 const highlights=report.highlights||[]
 if(!highlights.length)svg+=text(48,964,t('More data needed'),20,'#536174')
 highlights.forEach((m,i)=>{svg+=lines(48,960+i*65,(m.exercise?name(m.exercise):label(m))+': '+(m.delta>0?'+':'')+val(m.delta,m.deltaUnit),20,78,2)})
 svg+=lines(48,1250,t('Only recorded data. Changes are not automatically improvements.'),18,90,2)
 if(!cards.length)svg+=lines(48,1030,t('No comparable history in this period.'),22,70,2)
 if(q?.workouts)pages.push({svg:svg+footer(1),width:1000,height:1390})
 else if(!cards.length)pages.push({svg:header()+lines(48,240,t('No comparable history in this period.'),24,60,3)+footer(1),width:1000,height:1390})
 for(let i=0;i<cards.length;i+=8){
  svg=header()
  cards.slice(i,i+8).forEach((c,j)=>{const x=48+(j%2)*462,y=192+Math.floor(j/2)*274
   svg+=`<rect x="${x}" y="${y}" width="442" height="260" rx="16" fill="white" stroke="#dce2e9"/>`
   svg+=lines(x+18,y+27,c.title,16,48,2)+lines(x+18,y+74,c.label,21,33,2)+text(x+18,y+129,c.value,29,'#17212f',700)+text(x+18,y+157,c.detail||'',18,'#b51e28')+text(x+18,y+183,c.baseline||'',17,'#536174')+text(x+18,y+240,c.dates||'',15,'#536174')
   if(c.metric)svg+=spark(c.metric,x+20,y+195,395,22)
  })
  pages.push({svg:svg+footer(pages.length+1),width:1000,height:1390})
 }
 for(let i=0;i<records.length;i+=12){
  svg=header()+text(48,207,t('Personal Records'),26,'#17212f',700)
  records.slice(i,i+12).forEach((p,j)=>{const y=234+j*88
   svg+=`<rect x="48" y="${y}" width="904" height="80" rx="12" fill="white" stroke="#dce2e9"/>`
   svg+=lines(64,y+24,name(p.exercise),18,48,2)+text(64,y+66,p.d+' · '+t(p.label),14,'#536174')
   svg+=text(650,y+31,val(p.value,p.unit),23,'#17212f',700)+text(650,y+59,t('Baseline')+': '+val(p.previous,p.unit),15,'#536174')
  })
  pages.push({svg:svg+footer(pages.length+1),width:1000,height:1390})
 }
 return pages
}
