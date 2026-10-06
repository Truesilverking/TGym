import { useEffect, useMemo, useRef, useState } from 'react'
import { REPORT_EXPORTS, PDF_REPORT_EXPORTS, buildSelectedReports, saveSelectedReports, selectedReports } from '../lib/report-exports.js'
import { STATS_SECTIONS } from '../lib/stats-sections.js'
import { STREAK_PERIODS, buildStreakReport } from '../lib/streak-report.js'
import { PROGRESS_PERIODS, progressRange } from '../lib/progress-report.js'
import { t } from '../lib/i18n.js'
import { exerciseNameFor } from '../lib/i18n-core.js'
import { isoOf, fmtNum } from '../lib/format.js'
import { useLocalNow } from '../lib/use-local-now.js'
import { validDate } from '../lib/training-history.js'
import { Button } from './ui.jsx'
import ReportDateRange from './ReportDateRange.jsx'
import './ReportsExport.css'

export default function ReportsExport({ S, anchor = new Date(), close, pdf = false, statsFilters = {} }) {
  const catalog=pdf?PDF_REPORT_EXPORTS:REPORT_EXPORTS
  const now=useLocalNow(), today=isoOf(now)
  const [selected,setSelected]=useState(['streak']), [settings,setSettings]=useState({
    streak:{period:'this-week',from:isoOf(anchor),to:today,anchor:isoOf(anchor),format:'pdf'},
    consistency:{period:'month',anchor:isoOf(anchor),format:'pdf'},
    progress:{period:'all',from:S.trainingStartDate || today,to:today},
    history:{period:'all',query:''},
    stats:{sections:STATS_SECTIONS.map(([id])=>id),filters:statsFilters}
  })
  const [busy,setBusy]=useState(false),[files,setFiles]=useState([]),[results,setResults]=useState([]),[error,setError]=useState('')
  const working=useRef(false),mounted=useRef(true),current=useRef({S,today})
  current.current={S,today}
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
  useEffect(()=>{setFiles([]);setResults([]);setError('')},[S,settings,today])
  const change=(id,value)=>setSettings(s=>({...s,[id]:value}))
  const streak=useMemo(()=>buildStreakReport(S,{...settings.streak,now}),[S,settings.streak,today])
  const progress=useMemo(()=>progressRange(S,{...settings.progress,now}),[S,settings.progress,today])
  const invalid=id=>id==='streak'?streak.range.error:id==='progress'?progress.error:id==='consistency'&&!validDate(settings.consistency.anchor)?'Choose a valid date range.':id==='stats'&&pdf&&!settings.stats.sections.length?'Select at least one section.':null
  const download=async ids=>{
    if(working.current)return
    const selection=selectedReports(ids)
    setSelected(selection)
    if(selection.some(invalid))return
    working.current=true;setBusy(true);setError('')
    try {
      const prepared=await buildSelectedReports(S,selection,settings,{now,t,name:(exercise,context)=>exerciseNameFor(exercise,S,context),formatNumber:fmtNum,combinePDF:pdf})
      if(!mounted.current || current.current.S!==S || current.current.today!==today)return
      setFiles(prepared)
      const saved=await saveSelectedReports(prepared,selection)
      if(mounted.current)setResults(saved)
    } catch { if(mounted.current)setError(t('Could not export. Try again.')) }
    finally { working.current=false;if(mounted.current)setBusy(false) }
  }
  const retry=async id=>{
    if(working.current)return
    working.current=true;setBusy(true)
    try { const saved=await saveSelectedReports(files,files.find(file=>file.id===id)?.reportIds||[id]);if(mounted.current)setResults(r=>r.filter(v=>v.id!==id).concat(saved)) }
    finally {working.current=false;if(mounted.current)setBusy(false)}
  }
  return <section className="reports-export" aria-label={t('Export Reports')}>
    <h3>{t('Export Reports')}</h3><p className="small dim">{t(pdf?'Selected dashboards download as one PDF.':'Each report downloads as a separate file.')}</p>
    <label className="report-choice"><input type="checkbox" disabled={busy} checked={selected.length===catalog.length} ref={el=>{if(el)el.indeterminate=selected.length>0&&selected.length<catalog.length}} onChange={e=>setSelected(e.target.checked?catalog.map(([id])=>id):[])}/>{t('Select All')}</label>
    {catalog.map(([id,title])=><div className="report-option" data-report={id} key={id}>
      <label className="report-choice"><input type="checkbox" disabled={busy} checked={selected.includes(id)} onChange={e=>setSelected(s=>e.target.checked?[...s,id]:s.filter(v=>v!==id))}/>{t(title)}<small>{pdf?'PDF':id==='stats'?'HTML':id==='history'?'CSV':['plan','backup'].includes(id)?'JSON':'PDF'}</small></label>
      {selected.includes(id)&&<div className="report-settings">
        {id==='streak'&&<><ReportDateRange value={settings.streak} onChange={v=>change(id,v)} periods={STREAK_PERIODS} disabled={busy} today={today}/><p className="small dim">{streak.range.start} – {streak.range.end}</p>{streak.noData&&<p className="small dim">{t('No recorded activity in this period.')}</p>}</>}
        {id==='consistency'&&<><label>{t('Period')}<select className="input" disabled={busy} value={settings[id].period} onChange={e=>change(id,{...settings[id],period:e.target.value})}>{[['week','Week'],['month','Month'],['year','Year'],['full','Full report']].map(([v,label])=><option key={v} value={v}>{t(label)}</option>)}</select></label><label>{t('Date')}<input className="input" type="date" disabled={busy} value={settings[id].anchor} onChange={e=>change(id,{...settings[id],anchor:e.target.value})}/></label></>}
        {id==='progress'&&<ReportDateRange value={settings.progress} onChange={v=>change(id,v)} periods={PROGRESS_PERIODS} disabled={busy} today={today}/>}
        {id==='history'&&<><label>{t('Period')}<select className="input" disabled={busy} value={settings[id].period} onChange={e=>change(id,{...settings[id],period:e.target.value})}>{[['all','All'],['30','30 days'],['90','90 days']].map(([v,label])=><option key={v} value={v}>{t(label)}</option>)}</select></label><label>{t('Search workouts or exercises…')}<input className="input" disabled={busy} value={settings[id].query} onChange={e=>change(id,{...settings[id],query:e.target.value})}/></label></>}
        {id==='stats'&&(pdf?<><p className="small dim">{t('Uses the current Stats filters.')}</p>{STATS_SECTIONS.map(([section,title])=><label className="report-choice" data-report-section={section} key={section}><input type="checkbox" disabled={busy} checked={settings.stats.sections.includes(section)} onChange={e=>change('stats',{...settings.stats,sections:e.target.checked?[...settings.stats.sections,section]:settings.stats.sections.filter(value=>value!==section)})}/>{t(title)}</label>)}</>:<p className="small dim">{t('Since Start')}</p>)}
        {id==='plan'&&<p className="small dim">{t('Current plan; date filters do not apply.')}</p>}
        {id==='backup'&&<p className="small dim">{t('Complete profile; date filters do not apply.')}</p>}
        {invalid(id)&&<p role="alert">{t(invalid(id))}</p>}
      </div>}
    </div>)}
    <div className="report-actions"><Button variant="primary" icon="download" disabled={busy||!selected.length||selected.some(invalid)} onClick={()=>download(selected)}>{t(busy?'Working…':'Download Selected')}</Button><Button icon="download" disabled={busy} onClick={()=>download(catalog.map(([id])=>id))}>{t('Download All')}</Button></div>
    {error&&<p role="alert">{error}</p>}
    {files.length>0&&<ul className="report-results" aria-live="polite">{files.map(file=>{const status=results.find(r=>r.id===file.id)?.status;return <li key={file.id}><span>{file.name}<small>{status&&t(status==='saved'?'Downloaded':status==='canceled'?'Canceled':'Export failed. Please try again.')}</small></span><Button size="sm" disabled={busy} onClick={()=>retry(file.id)}>{t('Download')}</Button></li>})}</ul>}
    <Button disabled={!pdf&&busy} onClick={close}>{t(pdf?'Cancel':'Done')}</Button>
  </section>
}
