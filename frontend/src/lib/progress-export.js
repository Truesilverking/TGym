import { MEASUREMENT_ZONES,measurementMapSvg,CHANGE_STYLES,measurementChange } from './measurement-map.js'
import { compareBody } from './body-report.js'
import { buildProgressReport } from './progress-report.js'
import { PROGRESS_SECTIONS } from './progress-sections.js'
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
function sections(report,t,name) {
 const q=report.summary
 if(!q)return []
 return [
  {title:t('Your progress'),lines:[...Object.entries({ 'Total workouts':q.workouts,'Active days':q.activeDays,'Average workouts per week':q.averagePerWeek,'Total time (min)':q.timedSessions?q.totalMinutes:null,'Average duration (min)':q.averageMinutes,'Scheduled':q.planned,'Completed':q.completed,'Missed':q.missed,'Completion':q.rate==null?null:q.rate*100,'Longest active-day streak':q.longestStreak,'Current active-day streak':q.currentStreak,'Personal Records':report.records.length}).map(([label,value])=>({label:t(label),value,unit:label==='Completion'?'%':''})),...report.highlights.map(m=>({label:(m.exercise?name(m.exercise):t(m.label))+' · '+t('Change'),value:m.delta,unit:m.deltaUnit}))]},
  {title:t('Body Progress'),metrics:report.body},...report.exercises.map(e=>({title:t('Routine progress')+' · '+((report.routines||[]).find(r=>r.key===e.routineKey)?.name||t('Routine'))+' · '+name(e.exercise)+' · '+t(e.mode==='reps'?'Reps':e.mode==='time'?'Time':'Cardio')+' / '+t(e.type)+' / '+t(e.role)+(e.bwMode?' / '+t('Bodyweight'):'')+(e.side?' / '+t('/ side'):''),metrics:e.metrics,lines:[{label:t('Sessions'),value:e.sessions.length},{label:t('Personal Records'),value:e.records.length}]})),
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
// Flow complete rows onto pages; repeat section context after every page break.
// Only Progress Report callers supply a progress snapshot and selected sections.
export function progressReportPages(S,{t=x=>x,now=new Date(),name=e=>e.n||e.id,formatNumber=n=>Number(n.toFixed(1)).toLocaleString(),report=buildProgressReport(S,{now}),sections:chosen=PROGRESS_SECTIONS.map(s=>s[0]),bodySelection={},bodyGeometry}={}) {
 const val=(n,u='')=>n==null?'—':formatNumber(n)+(u?' '+t(u):'')
 const label=m=>m.muscle?t(m.label,t(m.muscle)):t(m.label)
 const text=(x,y,s,size=18,color='#17212f',weight=400)=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}">${esc(s)}</text>`
 const wrap=(s,width)=>wrapProgressText(s,width)
 const lines=(x,y,rows,size=18,color='#17212f',weight=400)=>rows.map((s,i)=>text(x,y+i*(size+5),s,size,color,weight)).join('')
 const rect=(x,y,w,h)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="white" stroke="#dce2e9"/>`
 const enabled=new Set(chosen.filter(id=>PROGRESS_SECTIONS.some(s=>s[0]===id))),rendered=new Set()
 if(!enabled.size)throw new Error('Select at least one section.')
 const pages=[];let svg='',y=0,hasContent=false
 const start=()=>{svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1390"><rect width="1000" height="1390" fill="#f8fafc"/><g font-family="Arial,sans-serif"><rect width="1000" height="8" fill="#b51e28"/>${text(44,46,'TGym',20,'#b51e28',700)}${text(44,87,t('Progress Report'),30,'#17212f',700)}${text(44,117,report.range.start+' → '+report.range.end,18,'#536174')}`;y=150;hasContent=false}
 const finish=()=>{if(hasContent)pages.push(svg)}
 const next=()=>{finish();start()}
 const headingRows=h=>({title:wrap(h.title,65),sub:wrap(h.sub,90)})
 const headingHeight=h=>{const r=headingRows(h);return r.title.length*29+r.sub.length*23+24}
 const heading=h=>{const r=headingRows(h);svg+=lines(44,y+24,r.title,24,'#17212f',700);y+=r.title.length*29;svg+=lines(44,y+20,r.sub,18,'#536174');y+=r.sub.length*23+24;hasContent=true}
 // Never orphan a heading or split a card. Continuations always repeat context.
 const group=(h,rows)=>{if(!enabled.has(h.id)||!rows.length)return
  rendered.add(h.id)
  let first=true
  for(const row of rows){
   if(y+row.height+(first?headingHeight(h):0)>1310){next();first=true}
   if(first){heading(h);first=false}
   svg+=row.draw(y);y+=row.height;hasContent=true
  }
  y+=16
 }
 const pairRows=(items,make)=>{const rows=[];for(let i=0;i<items.length;i+=2){const cards=items.slice(i,i+2).map(make),height=Math.max(...cards.map(c=>c.height));rows.push({height:height+12,draw:y=>cards.map((c,j)=>c.draw(44+j*464,y,height)).join('')})}return rows}
 start()
 const q=report.summary
 const sectionHead=id=>{const [,title,sub]=PROGRESS_SECTIONS.find(s=>s[0]===id);return {id,title:t(title),sub:t(sub)}}
 const tileRows=items=>{const rows=[]
  for(let i=0;i<items.length;i+=3){const cells=items.slice(i,i+3),height=Math.max(...cells.map(([l])=>wrap(t(l),25).length))*23+58
   rows.push({height:height+10,draw:y=>cells.map(([l,n,u],j)=>{const x=44+j*309;return rect(x,y,295,height)+text(x+16,y+35,val(n,u),28,'#17212f',700)+lines(x+16,y+62,wrap(t(l),25),18,'#536174')}).join('')})
  }return rows
 }
 const metricRows=items=>pairRows(items,m=>{
  const title=wrap(label(m),36),change=m.delta==null?t('More data needed'):(m.delta>0?'+':'')+val(m.delta,m.deltaUnit)+(m.percent==null?'':' · '+val(m.percent,'%'))
  const details=wrap(change,42),height=(m.points.length>1?150:120)+(title.length-1)*25+(details.length-1)*23
  return {height,draw:(x,y,h)=>{const top=y+title.length*25;return rect(x,y,448,h)+lines(x+16,y+25,title,20,'#17212f',700)+text(x+16,top+33,val(m.last?.y,m.unit),27,'#17212f',700)+text(x+230,top+32,t('Baseline')+': '+val(m.first?.y,m.unit),16,'#536174')+lines(x+16,top+60,details,18,'#b51e28')+spark(m,x+16,y+height-55,414,25)+text(x+16,y+height-15,m.first.d+' → '+m.last.d,16,'#536174')}}
 })
 const recordRows=items=>items.map(p=>{const title=wrap(name(p.exercise),48),detail=wrap(p.d+' · '+t(p.label),60),height=title.length*23+detail.length*21+20
  return {height:height+8,draw:y=>rect(44,y,912,height)+lines(60,y+25,title,18,'#17212f',700)+lines(60,y+title.length*23+25,detail,16,'#536174')+text(665,y+29,val(p.value,p.unit),23,'#17212f',700)+text(665,y+54,t('Baseline')+': '+val(p.previous,p.unit),16,'#536174')}
 })
 if(q?.workouts){
  group(sectionHead('overview'),tileRows([['Total workouts',q.workouts],['Active days',q.activeDays],['Personal Records',report.records.length],['Average workouts per week',q.averagePerWeek],['Total time (min)',q.timedSessions?q.totalMinutes:null],['Average duration (min)',q.averageMinutes]]))
  group({...sectionHead('consistency'),sub:sectionHead('consistency').sub+' '+t('Adherence uses the available schedule; earlier plans are not reconstructed.')},tileRows([['Active days',q.activeDays],['Planned',q.planned],['Completed',q.completed],['Extra',q.extra],['Missed',q.missed],['Pending',q.pending],['Completion',q.rate==null?null:q.rate*100,'%'],['Longest active-day streak',q.longestStreak],['Current active-day streak',q.currentStreak]]))
  group(sectionHead('duration'),[...tileRows([['Total time (min)',q.timedSessions?q.totalMinutes:null],['Average duration (min)',q.averageMinutes],['Median',q.medianMinutes,'min']]),...metricRows(report.training.filter(m=>m.key==='duration'))])
 }
 for(const r of report.routines||[]){
  const routineTitle=t('Routine progress')+' · '+(r.name||t('Routine'))
  const sub=r.legacy?t('History without a routine ID stays separate from current routines.'):t('Sessions stay grouped by routine, including exercises recorded before later edits.')
  group({id:'routines',title:routineTitle,sub:sub+' '+t('Adherence uses the available schedule; earlier plans are not reconstructed.')},[...tileRows([['Sessions',r.count],['Average duration (min)',r.averageMinutes],['Median',r.medianMinutes,'min'],['Completion',r.rate==null?null:r.rate*100,'%'],['Total volume',r.volume,report.unit],['Average workouts per week',r.averagePerWeek]]),...metricRows(r.metrics)])
  for(const e of r.exercises)group({id:'routines',title:(r.name||t('Routine'))+' · '+name(e.exercise),sub:t('Exercise Progress')+' · '+t(e.mode==='reps'?'Reps':e.mode==='time'?'Time':'Cardio')+' / '+t(e.type)+' / '+t(e.role)+(e.bwMode?' / '+t('Bodyweight'):'')+(e.side?' / '+t('/ side'):'')+' · '+t('Baseline → Current → Change → Trend')},metricRows(e.metrics))
  group({id:'routines',title:(r.name||t('Routine'))+' · '+t('Personal Records'),sub:t('Records beat an earlier recorded best in the same comparison group. Equal sets do not create duplicate records.')},recordRows(r.records))
 }
 const body=compareBody(report.bodyRecords||[],bodySelection.before,bodySelection.after)
 const renderBody=()=>{if(body.metrics.length){
  const model={height:380,draw:y=>rect(44,y,912,368)+`<g transform="translate(0 ${y+4})">${measurementMapSvg(bodyGeometry,report.bodyType,body.metrics)}</g>`+body.metrics.map((m,i)=>text(365,y+30+i*25,CHANGE_STYLES[measurementChange(m)].symbol+' '+t(m.label),17,'#536174')+text(690,y+30+i*25,val(m.last,m.unit),19,'#17212f',700)).join('')}

  const comparison=pairRows(body.metrics,m=>{const title=wrap(t(m.label),35),detail=m.delta==null?t('More data needed'):(m.delta>0?'+':'')+val(m.delta,m.unit)+' · '+(m.percent>0?'+':'')+val(m.percent,'%'),height=95+title.length*25;return {height,draw:(x,y,h)=>rect(x,y,448,h)+lines(x+16,y+27,title,20,'#17212f',700)+text(x+16,y+title.length*25+35,val(m.first,m.unit)+' → '+val(m.last,m.unit),23,'#17212f',700)+text(x+16,y+height-38,detail,18,'#b51e28')+text(x+16,y+height-15,body.before.d+' → '+body.after.d,16,'#536174')}})

  const facts=[[t('First record'),report.bodyRecords[0].d],[t('Current record'),body.after.d],[t('Largest increase'),body.increase?t(body.increase.label)+' · '+val(body.increase.delta,body.increase.unit):'—'],[t('Largest decrease'),body.decrease?t(body.decrease.label)+' · '+val(body.decrease.delta,body.decrease.unit):'—'],[t('No significant change'),body.stable.length?body.stable.map(m=>t(m.label)).join(', '):'—']]
  const factRows=pairRows(facts,([title,v])=>{const rows=wrap(title+': '+v,40);return {height:rows.length*24+12,draw:(x,y)=>lines(x+16,y+22,rows,18)}})
  const note=wrap(t('Changes below 0.1 cm are treated as unchanged. Missing values are not zero.'),90)
  group({...sectionHead('body'),sub:t('Before')+': '+body.before.d+' · '+t('After')+': '+body.after.d},[model,...tileRows([['Records',body.count],['Elapsed days',body.days]]),...comparison,...factRows,{height:note.length*23+16,draw:y=>lines(60,y+22,note,17,'#536174')},...metricRows(report.body.filter(m=>!m.key.startsWith('inbody:')&&!MEASUREMENT_ZONES[m.key]))])
 }
 }
 const groups=[
  {...sectionHead('performance'),metrics:report.training.filter(m=>m.key!=='duration')},
  {id:'performance',title:t('Activity Progress'),sub:t('Baseline → Current → Change → Trend'),metrics:report.activities.map(m=>({...m,label:t(m.activity)+' · '+t(m.label)}))},
  {...sectionHead('body'),metrics:body.metrics.length?[]:report.body.filter(m=>!m.key.startsWith('inbody:'))},
  {...sectionHead('inbody'),metrics:report.body.filter(m=>m.key.startsWith('inbody:'))},
 ]
 for(const section of groups){if(section.id==='body')renderBody();group(section,metricRows(section.metrics||[]))}
 group(sectionHead('trends'),pairRows(report.highlights||[],m=>{const routine=(report.routines||[]).find(r=>r.key===m.routineKey),title=wrap((routine?(routine.name||t('Routine'))+' · ':'')+(m.exercise?name(m.exercise):label(m)),38),height=title.length*23+59;return {height,draw:(x,y,h)=>rect(x,y,448,h)+lines(x+16,y+25,title)+text(x+16,y+height-17,(m.delta>0?'+':'')+val(m.delta,m.deltaUnit),22,'#b51e28',700)}}))
 // Compatibility with caller-created snapshots predating routine grouping.
 if(!report.routines){
  for(const e of report.exercises||[])group({id:'routines',title:t('Exercise Progress')+' · '+name(e.exercise),sub:t('Baseline → Current → Change → Trend')},metricRows(e.metrics))
  group({id:'routines',title:t('Personal Records'),sub:t('Records beat an earlier recorded best in the same comparison group. Equal sets do not create duplicate records.')},recordRows(report.records||[]))
 }
 for(const id of enabled)if(!rendered.has(id))group(sectionHead(id),[{height:38,draw:y=>text(44,y+20,t('No comparable history in this period.'),18,'#536174')}])
 finish()
 return pages.map((page,i)=>({svg:page+text(44,1350,'TGym · '+t('Progress Report'),16,'#536174')+text(875,1350,(i+1)+' / '+pages.length,16,'#536174')+'</g></svg>',width:1000,height:1390}))
}
