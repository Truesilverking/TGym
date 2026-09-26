import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { buildProgressReport, PROGRESS_PERIODS } from '../lib/progress-report.js'
import { t, exerciseNameFor } from '../lib/i18n.js'
import { fmtNum, fmtDate, todayISO } from '../lib/format.js'
import { Button } from '../components/ui.jsx'
import LineChart from '../components/LineChart.jsx'
import { bwSheet, measurementsSheet, inBodySheet, heightSheet } from '../sheets.jsx'
import { MOBILE, shareExport } from '../lib/mobile.js'
import './ProgressReport.css'
import { progressReportHTML } from '../lib/progress-export.js'

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
    <div className="row between"><h3>{metricLabel(m)}</h3><span className="small dim">{t(m.status)}</span></div>
    <div className="progress-values"><div><small>{t('Baseline')}</small><b>{value(m.first?.y,m.unit)}</b></div><span aria-hidden="true">→</span><div><small>{t('Current')}</small><b>{value(m.last?.y,m.unit)}</b></div></div>
    <p className="progress-change">{change(m)}</p>
    {m.first&&<p className="dim small">{fmtDate(m.first.d,false,true)} → {fmtDate(m.last.d,false,true)}{m.days!=null?' · '+t('{0} days',fmtNum(m.days)):''}</p>}
    {m.points.length>1&&<><span className="small dim">{t('Trend')}: {t(m.slope==null?'Insufficient Data':Math.abs(m.slope)<1e-8?'Stable':m.slope>0?'Increasing':'Decreasing')}</span><div className="chart"><LineChart points={m.points.length>180?m.points.filter((_,i)=>i===m.points.length-1||i%Math.ceil(m.points.length/179)===0):m.points} h={120} unit={t(m.unit)}/></div></>}
    <details><summary>{t('Measurement history')} · {fmtNum(m.points.length)}</summary><ol className="progress-history">{[...m.points].reverse().slice(0,count).map((p,i)=><li key={p.t+':'+i}><time>{fmtDate(p.d,false,true)}</time><b>{value(p.y,m.unit)}</b></li>)}</ol>{count<m.points.length&&<Button size="sm" onClick={()=>setCount(n=>n+50)}>{t('Show more')}</Button>}</details>
  </article>
}
function Metrics({items}) {return items.length?<div className="progress-grid">{items.map(m=><Metric key={m.key} metric={m}/>)}</div>:<p className="empty">{t('No comparable history in this period.')}</p>}
export default function ProgressReport() {
  const S=useStore(s=>s.S),nav=useNavigate(),[period,setPeriod]=useState('all'),[from,setFrom]=useState(S.trainingStartDate||todayISO()),[to,setTo]=useState(todayISO()),[error,setError]=useState('')
  const today=todayISO(),report=useMemo(()=>buildProgressReport(S,{period,from,to,now:new Date()}),[S,period,from,to,today])
  const q=report.summary
  const exportReport=async()=>{try{setError('');const filename=`TGym-progress-${report.range.start}-${report.range.end}.html`,html=progressReportHTML(report,{t,exerciseNameFor,fmtNum,fmtDate});if(MOBILE)await shareExport(html,filename);else{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}}catch{setError(t('Could not export. Try again.'))}}
  return <div className="progress-report">
    <div className="hdr"><div><h1>{t('Progress Report')}</h1><p className="sub">{t('Baseline → Current → Change → Trend')}</p></div><Button size="sm" onClick={()=>nav('/stats')}>{t('Back')}</Button></div>
    <div className="card progress-controls"><label>{t('Period')}<select className="input" value={period} onChange={e=>setPeriod(e.target.value)}>{PROGRESS_PERIODS.map(([v,l])=><option key={v} value={v}>{t(l)}</option>)}</select></label>{period==='custom'&&<><label>{t('From')}<input className="input" type="date" value={from} max={to} onChange={e=>setFrom(e.target.value)}/></label><label>{t('To')}<input className="input" type="date" value={to} min={from} max={today} onChange={e=>setTo(e.target.value)}/></label></>}<Button size="sm" disabled={!!report.range.error} onClick={exportReport}>{t('Export Progress Report')}</Button></div>
    {(error||report.range.error)&&<p role="alert">{error||t(report.range.error)}</p>}
    {q&&!q.workouts&&!report.body.length&&<section className="card"><p className="empty">{t('No comparable history in this period.')}</p><Button onClick={()=>measurementsSheet()}>{t('Log')}</Button></section>}
    {q&&(q.workouts>0||report.body.length>0)&&<>
      <section className="card"><h2>{t('Your progress')}</h2><p className="dim">{fmtDate(report.range.start,false,true)} → {fmtDate(report.range.end,false,true)}</p><div className="progress-summary">{[['Total workouts',q.workouts],['Active days',q.activeDays],['Personal Records',report.records.length],['Average workouts per week',q.averagePerWeek],['Total time (min)',q.timedSessions?q.totalMinutes:null],['Average duration (min)',q.averageMinutes]].map(([label,n])=><div key={label}><b>{value(n)}</b><span>{t(label)}</span></div>)}</div><p className="small dim">{t('Only recorded data. Changes are not automatically improvements.')}</p></section>
      <Fold title={t('Highlights')} open>{report.highlights.length?<ul>{report.highlights.map((m,i)=><li key={i}>{m.exercise?exerciseNameFor(m.exercise):metricLabel(m)}: <b>{change(m)}</b></li>)}</ul>:<p>{t('More data needed')}</p>}</Fold>
      <Fold title={t('Body Progress')} open><div className="progress-actions"><Button size="sm" onClick={()=>bwSheet()}>{t('Log body weight')}</Button><Button size="sm" onClick={()=>measurementsSheet()}>{t('Body measurements')}</Button><Button size="sm" onClick={inBodySheet}>{t('InBody history')}</Button><Button size="sm" onClick={heightSheet}>{t('Height')}</Button></div><Metrics items={report.body}/></Fold>
      <Fold title={t('Exercise Progress')} open><p className="small dim">{t('Comparisons separate mode, set type, role, bodyweight and per-side logging. RIR is interpreted with load and reps.')}</p>{report.exercises.length?report.exercises.map(e=><Fold key={e.key} title={`${exerciseNameFor(e.exercise)} · ${t(e.mode==='reps'?'Reps':e.mode==='time'?'Time':'Cardio')} · ${t(e.type)} · ${t(e.role)}${e.side?' · '+t('/ side'):''}`}><p>{t('Sessions')}: {fmtNum(e.sessions.length)} · {t(e.status)} | {t('Personal Records')}: {fmtNum(e.records.length)}</p><Metrics items={e.metrics}/></Fold>):<p className="empty">{t('No comparable history in this period.')}</p>}</Fold>
      <Fold title={t('Training volume')}>{!q.workouts?<p className="empty">{t('No comparable history in this period.')}</p>:<><p className="small dim">{t('Weekly comparisons use complete Monday–Sunday weeks only. Partial weeks are listed separately.')}</p><div className="progress-summary">{[['Total sets',q.sets],['Total reps',q.reps],['Total volume',q.volume],['Volume per workout',q.averageVolume]].map(([l,n])=><div key={l}><b>{value(n,l.includes('volume')||l==='Volume per workout'?report.unit:'')}</b><span>{t(l)}</span></div>)}</div><Metrics items={report.training}/><details><summary>{t('Weekly history')}</summary><ol className="progress-history">{[...report.weekly].reverse().map(w=><li key={w.d}><span>{fmtDate(w.d,false,true)} · {t(w.partial?'Partial week':'Complete week')}</span><b>{value(w.volume,report.unit)} · {t('{0} workouts',w.workouts)}</b></li>)}</ol></details></>}</Fold>
      <Fold title={t('Training consistency')}><div className="progress-summary">{[['Scheduled',q.planned],['Completed',q.completed],['Missed',q.missed],['Pending',q.pending],['Completion',q.rate==null?null:q.rate*100],['Longest active-day streak',q.longestStreak],['Current active-day streak',q.currentStreak]].map(([l,n])=><div key={l}><b>{value(n,l==='Completion'?'%':'')}</b><span>{t(l)}</span></div>)}</div><p className="small dim">{t('Streaks count consecutive days with recorded training. Pending days are not missed workouts.')}</p></Fold>
      <Fold title={t('Activity Progress')}><Metrics items={report.activities.map(m=>({...m,label:t(m.activity)+' · '+t(m.label)}))}/></Fold>
      <Fold title={t('Personal Records')}><p className="small dim">{t('Records beat an earlier recorded best in the same comparison group. Equal sets do not create duplicate records.')}</p>{report.records.length?<ol className="progress-history">{report.records.map(p=><li key={p.key}><span>{exerciseNameFor(p.exercise)}<small>{fmtDate(p.d,false,true)} · {t(p.label)}</small></span><b>{value(p.previous,p.unit)} → {value(p.value,p.unit)}{p.r!=null&&<small>{value(p.w,report.unit)} × {value(p.r)}</small>}</b></li>)}</ol>:<p>{t('No records in this period.')}</p>}</Fold>
    </>}
  </div>
}
