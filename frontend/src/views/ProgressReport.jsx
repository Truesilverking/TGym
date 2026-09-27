import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { buildProgressReport, PROGRESS_PERIODS } from '../lib/progress-report.js'
import { t, exerciseNameFor } from '../lib/i18n.js'
import { fmtNum, fmtDate, todayISO } from '../lib/format.js'
import { Button } from '../components/ui.jsx'
import ProgressBody from '../components/ProgressBody.jsx'
import LineChart from '../components/LineChart.jsx'
import { bwSheet, measurementsSheet, inBodySheet, heightSheet } from '../sheets.jsx'
import { MOBILE } from '../lib/mobile.js'
import './ProgressReport.css'
import { PROGRESS_SECTIONS } from '../lib/progress-sections.js'
import { buildProgressFile, saveProgressFile } from '../lib/progress-file.js'

export const metricLabel = m => m.muscle?t(m.label,t(m.muscle)):t(m.label)
const value = (n,u='') => n==null?'—':`${fmtNum(n)}${u?' '+t(u):''}`
const change = m => m.delta==null?t('More data needed'):`${m.delta>0?'+':''}${value(m.delta,m.deltaUnit)}${m.percent!=null?' · '+(m.percent>0?'+':'')+fmtNum(m.percent)+'%':''}`
const DashboardContext=createContext(null)
const PathContext=createContext('')
function useDisclosure(key,initial=false) {
  const [states,setStates]=useContext(DashboardContext),path=useContext(PathContext)+':'+key
  return [states[path]??initial,open=>setStates(s=>({...s,[path]:open})),path]
}
function Fold({id,title,children,open=false}) {
  const [expanded,setExpanded,path]=useDisclosure(id||title,open),visited=useRef(expanded)
  if(expanded)visited.current=true
  return <div className="progress-fold card"><button type="button" className="progress-fold-toggle" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{title}<span aria-hidden="true">{expanded?'−':'+'}</span></button><div className="progress-reveal" data-open={expanded} inert={!expanded}><div><PathContext.Provider value={path}>{visited.current&&children}</PathContext.Provider></div></div></div>
}
function Metric({metric:m}) {
  const [count,setCount]=useState(20)
  const [enlarged,setEnlarged]=useDisclosure(m.key+':chart')
  return <article className="progress-metric">
    <div className="row between"><h3>{metricLabel(m)}</h3><span className="progress-status">{t(m.status)}</span></div>
    <div className="progress-values"><div><small>{t('Baseline')}</small><b>{value(m.first?.y,m.unit)}</b><time>{fmtDate(m.first?.d,false,true)}</time></div><span aria-hidden="true">→</span><div><small>{t('Current')}</small><b>{value(m.last?.y,m.unit)}</b><time>{fmtDate(m.last?.d,false,true)}</time></div></div>
    <p className="progress-change">{change(m)}</p>
    {m.points.length>1&&<><span className="small dim">{t('Trend')}: {t(m.slope==null?'Insufficient Data':Math.abs(m.slope)<1e-8?'Stable':m.slope>0?'Increasing':'Decreasing')}</span><Button size="sm" aria-expanded={enlarged} onClick={()=>setEnlarged(!enlarged)}>{t(enlarged?'Collapse chart':'Expand chart')}</Button><div className="chart progress-chart" data-expanded={enlarged}><LineChart points={m.points.length>180?m.points.filter((_,i)=>i===m.points.length-1||i%Math.ceil(m.points.length/179)===0):m.points} h={enlarged?260:120} axes={enlarged} unit={t(m.unit)}/></div></>}
    <details><summary>{t('Measurement history')} · {fmtNum(m.points.length)}</summary><ol className="progress-history">{[...m.points].reverse().slice(0,count).map((p,i)=><li key={p.t+':'+i}><time>{fmtDate(p.d,false,true)}</time><b>{value(p.y,m.unit)}</b></li>)}</ol>{count<m.points.length&&<Button size="sm" onClick={()=>setCount(n=>n+50)}>{t('Show more')}</Button>}</details>
  </article>
}
function Metrics({items}) {return items.length?<div className="progress-grid">{items.map(m=><Metric key={m.key} metric={m}/>)}</div>:<p className="empty">{t('No comparable history in this period.')}</p>}
function Tiles({items}) {return <div className="progress-summary">{items.map(([label,n,unit=''])=><div key={label}><b>{value(n,unit)}</b><span>{t(label)}</span></div>)}</div>}
function Routine({routine:r,unit}) {
 return <Fold id={r.key} title={r.name||t('Routine')}>
  {r.legacy&&<p className="small dim">{t('History without a routine ID stays separate from current routines.')}</p>}
  <Tiles items={[["Sessions",r.count],["Average duration (min)",r.averageMinutes],["Median",r.medianMinutes,'min'],["Completion",r.rate==null?null:r.rate*100,'%'],["Total volume",r.volume,unit],["Average workouts per week",r.averagePerWeek]]}/>
  <p className="small dim">{t('Adherence uses the available schedule; earlier plans are not reconstructed.')}</p>
  <Metrics items={r.metrics}/>
  <h3>{t('Exercise Progress')}</h3><p className="small dim">{t('Comparisons separate mode, set type, role, bodyweight and per-side logging. RIR is interpreted with load and reps.')}</p>
  {r.exercises.map(e=><Fold key={e.key} id={e.key} title={`${exerciseNameFor(e.exercise)} · ${t(e.mode==='reps'?'Reps':e.mode==='time'?'Time':'Cardio')} · ${t(e.type)} · ${t(e.role)}${e.bwMode?' · '+t('Bodyweight'):''}${e.side?' · '+t('/ side'):''}`}><p>{t('Sessions')}: {fmtNum(e.sessions.length)} · {t(e.status)}</p><Metrics items={e.metrics}/></Fold>)}
  {r.records.length>0&&<Fold title={t('Personal Records')}><p className="small dim">{t('Records beat an earlier recorded best in the same comparison group. Equal sets do not create duplicate records.')}</p><ol className="progress-history">{r.records.map(p=><li key={p.key}><span>{exerciseNameFor(p.exercise)}<small>{fmtDate(p.d,false,true)} · {t(p.label)}</small></span><b>{value(p.previous,p.unit)} → {value(p.value,p.unit)}</b></li>)}</ol></Fold>}
 </Fold>
}
export default function ProgressReport() {
  const S=useStore(s=>s.S),nav=useNavigate(),[period,setPeriod]=useState('all'),[from,setFrom]=useState(S.trainingStartDate||todayISO()),[to,setTo]=useState(todayISO()),[error,setError]=useState('')
  const today=todayISO(),report=useMemo(()=>buildProgressReport(S,{period,from,to,now:new Date()}),[S,period,from,to,today])
  const q=report.summary
  const [section,setSection]=useState('overview'),dashboard=useState({})
  const [bodySelection,setBodySelection]=useState({}),[exportOpen,setExportOpen]=useState(false),[exportSections,setExportSections]=useState(PROGRESS_SECTIONS.map(s=>s[0]))
  const dialog=useRef(null)
  useEffect(()=>{if(exportOpen)dialog.current?.showModal();else dialog.current?.close()},[exportOpen])
  const selected=PROGRESS_SECTIONS.find(s=>s[0]===section)
  const [busy,setBusy]=useState(false),[file,setFile]=useState(null),exporting=useRef(false),currentReport=useRef(report),mounted=useRef(true)
  currentReport.current=report
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
  useEffect(()=>setBodySelection({}),[report])
  useEffect(()=>{setFile(null);setError('')},[report,bodySelection])
  useEffect(()=>()=>{if(file?.url)URL.revokeObjectURL(file.url)},[file])
  const exportReport=async()=>{
    if(exporting.current)return
    exporting.current=true;setBusy(true);setError('');setExportOpen(false)
    try{const result=await buildProgressFile(report,{t,name:exerciseNameFor,formatNumber:fmtNum,sections:exportSections,bodySelection});if(mounted.current&&currentReport.current===report){const ready={...result,url:URL.createObjectURL(result.blob)};setFile(ready);try{await saveProgressFile(ready)}catch(e){if(e?.name!=='AbortError'&&e?.message!=='Share canceled')setError(t('Could not export. Try again.'))}}}
    catch{setError(t('Could not export. Try again.'))}
    finally{exporting.current=false;setBusy(false)}
  }
  const download=async()=>{
    if(exporting.current)return
    exporting.current=true;setBusy(true);setError('')
    try{await saveProgressFile(file)}catch(e){if(e?.name!=='AbortError'&&e?.message!=='Share canceled')setError(t('Could not export. Try again.'))}
    finally{exporting.current=false;setBusy(false)}
  }
  return <DashboardContext.Provider value={dashboard}><div className="progress-report">
    <div className="hdr"><div><h1>{t('Progress Report')}</h1><p className="sub">{t('Baseline → Current → Change → Trend')}</p></div><Button size="sm" onClick={()=>nav('/stats')}>{t('Back')}</Button></div>
    <div className="card progress-controls"><label>{t('Period')}<select className="input" disabled={busy} value={period} onChange={e=>setPeriod(e.target.value)}>{PROGRESS_PERIODS.map(([v,l])=><option key={v} value={v}>{t(l)}</option>)}</select></label><label>{t('Section')}<select className="input" value={section} onChange={e=>setSection(e.target.value)}>{PROGRESS_SECTIONS.map(([id,title])=><option key={id} value={id}>{t(title)}</option>)}</select></label>{period==='custom'&&<><label>{t('From')}<input className="input" type="date" disabled={busy} value={from} max={to} onChange={e=>setFrom(e.target.value)}/></label><label>{t('To')}<input className="input" type="date" disabled={busy} value={to} min={from} max={today} onChange={e=>setTo(e.target.value)}/></label></>}<Button variant="primary" icon="download" disabled={busy||!!report.range.error} onClick={()=>setExportOpen(true)}>{t(busy?'Working…':'Export Progress Report')} · PDF</Button></div>
    {file&&<section className="card progress-file" aria-label={t('Export Progress Report')}><p role="status"><b>{file.name}</b></p><div className="progress-actions"><Button variant="primary" icon="download" disabled={busy} onClick={download}>{t(MOBILE?'Share / save':'Download')}</Button>{!MOBILE&&<a className="btn" href={file.url} target="_blank" rel="noopener noreferrer">{t('Open')}</a>}</div></section>}
    {(error||report.range.error)&&<p role="alert">{error||t(report.range.error)}</p>}
    {q&&<>
      <PathContext.Provider value={section}><section className="card progress-panel" aria-label={t(selected[1])}><h2>{t(selected[1])}</h2><p className="dim">{t(selected[2])}</p>
        {section==='overview'&&<><p className="small dim">{fmtDate(report.range.start,false,true)} → {fmtDate(report.range.end,false,true)}</p>{q.workouts?<Tiles items={[["Total workouts",q.workouts],["Active days",q.activeDays],["Personal Records",report.records.length],["Average workouts per week",q.averagePerWeek],["Total time (min)",q.timedSessions?q.totalMinutes:null],["Average duration (min)",q.averageMinutes]]}/>:report.body.length?<p>{metricLabel(report.body[0])}: <b>{value(report.body[0].last?.y,report.body[0].unit)}</b></p>:<p className="empty">{t('No comparable history in this period.')}</p>}</>}
        {section==='consistency'&&<><Tiles items={[["Scheduled",q.planned],["Completed",q.completed],["Missed",q.missed],["Pending",q.pending],["Completion",q.rate==null?null:q.rate*100,'%'],["Longest active-day streak",q.longestStreak],["Current active-day streak",q.currentStreak]]}/><p className="small dim">{t('Adherence uses the available schedule; earlier plans are not reconstructed.')}</p><p className="small dim">{t('Streaks count consecutive days with recorded training. Pending days are not missed workouts.')}</p></>}
        {section==='duration'&&<><Tiles items={[["Total time (min)",q.timedSessions?q.totalMinutes:null],["Average duration (min)",q.averageMinutes],["Median",q.medianMinutes,'min']]}/><Metrics items={report.training.filter(m=>m.key==='duration')}/>{report.routines.map(r=><article key={r.key} className="progress-metric"><h3>{r.name||t('Routine')}</h3><Tiles items={[["Sessions",r.timedSessions],["Average duration (min)",r.averageMinutes],["Median",r.medianMinutes,'min']]}/></article>)}</>}
        {section==='routines'&&(report.routines.length?report.routines.map(r=><Routine key={r.key} routine={r} unit={report.unit}/>):<p className="empty">{t('No comparable history in this period.')}</p>)}
        {section==='performance'&&<>{q.workouts>0&&<Tiles items={[["Total sets",q.sets],["Total reps",q.reps],["Total volume",q.volume,report.unit],["Volume per workout",q.averageVolume,report.unit]]}/>}<Metrics items={report.training.filter(m=>m.key!=='duration')}/><Fold title={t('Weekly history')}><ol className="progress-history">{report.weekly.map(w=><li key={w.d}><span>{fmtDate(w.d,false,true)} · {t(w.partial?'Partial week':'Complete week')}</span><b>{value(w.volume,report.unit)} · {t('{0} workouts',w.workouts)}</b></li>)}</ol></Fold>{report.activities.length>0&&<Fold title={t('Activity Progress')}><Metrics items={report.activities.map(m=>({...m,label:t(m.activity)+' · '+t(m.label)}))}/></Fold>}</>}
        {section==='body'&&<><div className="progress-actions"><Button size="sm" onClick={()=>bwSheet()}>{t('Log body weight')}</Button><Button size="sm" onClick={()=>measurementsSheet()}>{t('Body measurements')}</Button><Button size="sm" onClick={heightSheet}>{t('Height')}</Button></div><ProgressBody records={report.bodyRecords||[]} selection={bodySelection} onSelection={setBodySelection} disabled={busy}/><Fold title={t('Measurement history')}><Metrics items={report.body.filter(m=>!m.key.startsWith('inbody:'))}/></Fold></>}
        {section==='inbody'&&<><Button size="sm" onClick={inBodySheet}>{t('Log')}</Button><Metrics items={report.body.filter(m=>m.key.startsWith('inbody:'))}/></>}
        {section==='trends'&&<>{report.routines.map(r=><Fold key={r.key} id={r.key} title={r.name||t('Routine')} open><Metrics items={r.metrics}/></Fold>)}<Metrics items={report.body.filter(m=>m.points.length>1)}/></>}
      </section></PathContext.Provider>
    </>}
    <dialog ref={dialog} className="progress-export-dialog" aria-labelledby="progress-export-title" onCancel={()=>setExportOpen(false)}>
      <h2 id="progress-export-title">{t('Export Progress Report')}</h2><p>{fmtDate(report.range.start,false,true)} → {fmtDate(report.range.end,false,true)}</p>
      <label className="progress-export-choice"><input type="checkbox" checked={exportSections.length===PROGRESS_SECTIONS.length} onChange={e=>setExportSections(e.target.checked?PROGRESS_SECTIONS.map(s=>s[0]):[])}/>{t('Entire report')}</label>
      <div className="progress-export-options">{PROGRESS_SECTIONS.map(([id,title])=><label className="progress-export-choice" key={id}><input type="checkbox" checked={exportSections.includes(id)} onChange={e=>setExportSections(ids=>e.target.checked?[...ids,id]:ids.filter(v=>v!==id))}/>{t(title)}</label>)}</div>
      <p className="small dim">{exportSections.length?PROGRESS_SECTIONS.filter(([id])=>exportSections.includes(id)).map(([,title])=>t(title)).join(' · '):t('Select at least one section.')}</p>
      <div className="progress-actions"><Button onClick={()=>setExportOpen(false)}>{t('Cancel')}</Button><Button variant="primary" disabled={!exportSections.length||busy} onClick={exportReport}>{t('Generate and download')} · PDF</Button></div>
    </dialog>
  </div></DashboardContext.Provider>
}
