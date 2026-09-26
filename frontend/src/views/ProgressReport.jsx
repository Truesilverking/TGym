import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { buildProgressReport, PROGRESS_PERIODS } from '../lib/progress-report.js'
import { t, exerciseNameFor } from '../lib/i18n.js'
import { fmtNum, fmtDate, todayISO } from '../lib/format.js'
import { Button } from '../components/ui.jsx'
import LineChart from '../components/LineChart.jsx'
import { bwSheet, measurementsSheet, inBodySheet, heightSheet } from '../sheets.jsx'
import { MOBILE } from '../lib/mobile.js'
import './ProgressReport.css'
import { buildProgressFile, saveProgressFile } from '../lib/progress-file.js'

export const metricLabel = m => m.muscle?t(m.label,t(m.muscle)):t(m.label)
const value = (n,u='') => n==null?'—':`${fmtNum(n)}${u?' '+t(u):''}`
const change = m => m.delta==null?t('More data needed'):`${m.delta>0?'+':''}${value(m.delta,m.deltaUnit)}${m.percent!=null?' · '+(m.percent>0?'+':'')+fmtNum(m.percent)+'%':''}`
function Fold({title,children,open=false}) {
  const [expanded,setExpanded]=useState(open)
  return <details className="progress-fold card" open={expanded} onToggle={e=>setExpanded(e.currentTarget.open)}><summary>{title}</summary>{expanded&&children}</details>
}
function Metric({metric:m}) {
  const [count,setCount]=useState(20)
  return <article className="progress-metric">
    <div className="row between"><h3>{metricLabel(m)}</h3><span className="progress-status">{t(m.status)}</span></div>
    <div className="progress-values"><div><small>{t('Baseline')}</small><b>{value(m.first?.y,m.unit)}</b><time>{fmtDate(m.first?.d,false,true)}</time></div><span aria-hidden="true">→</span><div><small>{t('Current')}</small><b>{value(m.last?.y,m.unit)}</b><time>{fmtDate(m.last?.d,false,true)}</time></div></div>
    <p className="progress-change">{change(m)}</p>
    {m.points.length>1&&<><span className="small dim">{t('Trend')}: {t(m.slope==null?'Insufficient Data':Math.abs(m.slope)<1e-8?'Stable':m.slope>0?'Increasing':'Decreasing')}</span><div className="chart"><LineChart points={m.points.length>180?m.points.filter((_,i)=>i===m.points.length-1||i%Math.ceil(m.points.length/179)===0):m.points} h={120} unit={t(m.unit)}/></div></>}
    <details><summary>{t('Measurement history')} · {fmtNum(m.points.length)}</summary><ol className="progress-history">{[...m.points].reverse().slice(0,count).map((p,i)=><li key={p.t+':'+i}><time>{fmtDate(p.d,false,true)}</time><b>{value(p.y,m.unit)}</b></li>)}</ol>{count<m.points.length&&<Button size="sm" onClick={()=>setCount(n=>n+50)}>{t('Show more')}</Button>}</details>
  </article>
}
function Metrics({items}) {return items.length?<div className="progress-grid">{items.map(m=><Metric key={m.key} metric={m}/>)}</div>:<p className="empty">{t('No comparable history in this period.')}</p>}
export default function ProgressReport() {
  const S=useStore(s=>s.S),nav=useNavigate(),[period,setPeriod]=useState('all'),[from,setFrom]=useState(S.trainingStartDate||todayISO()),[to,setTo]=useState(todayISO()),[error,setError]=useState('')
  const today=todayISO(),report=useMemo(()=>buildProgressReport(S,{period,from,to,now:new Date()}),[S,period,from,to,today])
  const q=report.summary
  const [busy,setBusy]=useState(false),[file,setFile]=useState(null),exporting=useRef(false),currentReport=useRef(report),mounted=useRef(true)
  currentReport.current=report
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
  useEffect(()=>{setFile(null);setError('')},[report])
  useEffect(()=>()=>{if(file?.url)URL.revokeObjectURL(file.url)},[file])
  const exportReport=async()=>{
    if(exporting.current)return
    exporting.current=true;setBusy(true);setError('')
    try{const result=await buildProgressFile(report,{t,name:exerciseNameFor,formatNumber:fmtNum});if(mounted.current&&currentReport.current===report)setFile({...result,url:URL.createObjectURL(result.blob)})}
    catch{setError(t('Could not export. Try again.'))}
    finally{exporting.current=false;setBusy(false)}
  }
  const download=async()=>{
    if(exporting.current)return
    exporting.current=true;setBusy(true);setError('')
    try{await saveProgressFile(file)}catch(e){if(e?.name!=='AbortError'&&e?.message!=='Share canceled')setError(t('Could not export. Try again.'))}
    finally{exporting.current=false;setBusy(false)}
  }
  return <div className="progress-report">
    <div className="hdr"><div><h1>{t('Progress Report')}</h1><p className="sub">{t('Baseline → Current → Change → Trend')}</p></div><Button size="sm" onClick={()=>nav('/stats')}>{t('Back')}</Button></div>
    <div className="card progress-controls"><label>{t('Period')}<select className="input" disabled={busy} value={period} onChange={e=>setPeriod(e.target.value)}>{PROGRESS_PERIODS.map(([v,l])=><option key={v} value={v}>{t(l)}</option>)}</select></label>{period==='custom'&&<><label>{t('From')}<input className="input" type="date" disabled={busy} value={from} max={to} onChange={e=>setFrom(e.target.value)}/></label><label>{t('To')}<input className="input" type="date" disabled={busy} value={to} min={from} max={today} onChange={e=>setTo(e.target.value)}/></label></>}<Button variant="primary" icon="download" disabled={busy||!!report.range.error} onClick={exportReport}>{t(busy?'Working…':'Export Progress Report')} · PDF</Button></div>
    {file&&<section className="card progress-file" aria-label={t('Export Progress Report')}><p role="status"><b>{file.name}</b></p><div className="progress-actions"><Button variant="primary" icon="download" disabled={busy} onClick={download}>{t(MOBILE?'Share / save':'Download')}</Button>{!MOBILE&&<a className="btn" href={file.url} target="_blank" rel="noopener noreferrer">{t('Open')}</a>}</div></section>}
    {(error||report.range.error)&&<p role="alert">{error||t(report.range.error)}</p>}
    {q&&!q.workouts&&!report.body.length&&<section className="card"><p className="empty">{t('No comparable history in this period.')}</p><Button onClick={()=>measurementsSheet()}>{t('Log')}</Button></section>}
    {q&&(q.workouts>0||report.body.length>0)&&<>
      <section className="card"><h2>{t('Your progress')}</h2><p className="dim">{fmtDate(report.range.start,false,true)} → {fmtDate(report.range.end,false,true)}</p>{q.workouts>0&&<div className="progress-summary">{[['Total workouts',q.workouts],['Active days',q.activeDays],['Personal Records',report.records.length],['Average workouts per week',q.averagePerWeek],['Total time (min)',q.timedSessions?q.totalMinutes:null],['Average duration (min)',q.averageMinutes]].map(([label,n])=><div key={label}><b>{value(n)}</b><span>{t(label)}</span></div>)}</div>}<p className="small dim">{t('Only recorded data. Changes are not automatically improvements.')}</p></section>
      {report.highlights.length>0&&<section className="card"><h2>{t('Highlights')}</h2><ul className="progress-highlights">{report.highlights.map((m,i)=><li key={i}><span>{m.exercise?exerciseNameFor(m.exercise):metricLabel(m)}</span><b>{change(m)}</b></li>)}</ul></section>}
      {report.body.length>0&&<Fold title={t('Body Progress')} open><div className="progress-actions"><Button size="sm" onClick={()=>bwSheet()}>{t('Log body weight')}</Button><Button size="sm" onClick={()=>measurementsSheet()}>{t('Body measurements')}</Button><Button size="sm" onClick={inBodySheet}>{t('InBody history')}</Button><Button size="sm" onClick={heightSheet}>{t('Height')}</Button></div><Metrics items={report.body}/></Fold>}
      {report.exercises.length>0&&<Fold title={t('Exercise Progress')} open><p className="small dim">{t('Comparisons separate mode, set type, role, bodyweight and per-side logging. RIR is interpreted with load and reps.')}</p>{report.exercises.length?report.exercises.map(e=><Fold key={e.key} title={`${exerciseNameFor(e.exercise)} · ${t(e.mode==='reps'?'Reps':e.mode==='time'?'Time':'Cardio')} · ${t(e.type)} · ${t(e.role)}${e.bwMode?' · '+t('Bodyweight'):''}${e.side?' · '+t('/ side'):''}`}><p>{t('Sessions')}: {fmtNum(e.sessions.length)} · {t(e.status)} | {t('Personal Records')}: {fmtNum(e.records.length)}</p><Metrics items={e.metrics}/></Fold>):<p className="empty">{t('No comparable history in this period.')}</p>}</Fold>}
      {q.workouts>0&&<Fold title={t('Training volume')}>{!q.workouts?<p className="empty">{t('No comparable history in this period.')}</p>:<><p className="small dim">{t('Weekly comparisons use complete Monday–Sunday weeks only. Partial weeks are listed separately.')}</p><div className="progress-summary">{[['Total sets',q.sets],['Total reps',q.reps],['Total volume',q.volume],['Volume per workout',q.averageVolume]].map(([l,n])=><div key={l}><b>{value(n,l.includes('volume')||l==='Volume per workout'?report.unit:'')}</b><span>{t(l)}</span></div>)}</div><Metrics items={report.training}/><details><summary>{t('Weekly history')}</summary><ol className="progress-history">{[...report.weekly].reverse().map(w=><li key={w.d}><span>{fmtDate(w.d,false,true)} · {t(w.partial?'Partial week':'Complete week')}</span><b>{value(w.volume,report.unit)} · {t('{0} workouts',w.workouts)}</b></li>)}</ol></details></>}</Fold>}
      {q.workouts>0&&<Fold title={t('Training consistency')}><div className="progress-summary">{[['Scheduled',q.planned],['Completed',q.completed],['Missed',q.missed],['Pending',q.pending],['Completion',q.rate==null?null:q.rate*100],['Longest active-day streak',q.longestStreak],['Current active-day streak',q.currentStreak]].map(([l,n])=><div key={l}><b>{value(n,l==='Completion'?'%':'')}</b><span>{t(l)}</span></div>)}</div><p className="small dim">{t('Streaks count consecutive days with recorded training. Pending days are not missed workouts.')}</p></Fold>}
      {report.activities.length>0&&<Fold title={t('Activity Progress')}><Metrics items={report.activities.map(m=>({...m,label:t(m.activity)+' · '+t(m.label)}))}/></Fold>}
      {report.records.length>0&&<Fold title={t('Personal Records')}><p className="small dim">{t('Records beat an earlier recorded best in the same comparison group. Equal sets do not create duplicate records.')}</p>{report.records.length?<ol className="progress-history">{report.records.map(p=><li key={p.key}><span>{exerciseNameFor(p.exercise)}<small>{fmtDate(p.d,false,true)} · {t(p.label)}</small></span><b>{value(p.previous,p.unit)} → {value(p.value,p.unit)}{p.r!=null&&<small>{value(p.w,report.unit)} × {value(p.r)}</small>}</b></li>)}</ol>:<p>{t('No records in this period.')}</p>}</Fold>}
    </>}
  </div>
}
