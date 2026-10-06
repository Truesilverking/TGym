import { buildCalendarExport, buildConsistencyExport } from './calendar-file.js'
import { buildProgressReport } from './progress-report.js'
import { buildProgressFile, buildProgressPages } from './progress-file.js'
import { streakReportPages } from './streak-report.js'
import { calendarReportPages } from './calendar-report.js'
import { statsReportPages } from './stats-pdf.js'
import { loadBodyGeometry } from './body-geometry.js'
import { statsReportHTML } from './stats-report.js'
import { historyCsv } from './history-export.js'
import { buildPlanBundle } from './plan-share.js'
import { createBackup } from './backup.js'
import { reportPagesFile, saveReportFile, saveReportBatch } from './report-file.js'
import { MOBILE } from './mobile.js'
import { isoOf } from './format.js'
import { validDate } from './training-history.js'
import { exerciseNameFor } from './i18n-core.js'

// Each builder owns its content. This registry only selects independent files.
export const REPORT_EXPORTS = [['streak','Streak Report'],['consistency','Consistency Report'],['progress','Progress Report'],['stats','Stats'],['history','Workout history'],['plan','Plan'],['backup','Full backup']]
export const PDF_REPORT_EXPORTS = REPORT_EXPORTS.filter(([id])=>['streak','consistency','progress','stats'].includes(id))
export function selectedReports(ids) {
  return REPORT_EXPORTS.map(([id])=>id).filter(id=>ids.includes(id))
}
export async function buildDashboardReportPages(id, S, settings = {}, options = {}) {
  options={name:(exercise,context)=>exerciseNameFor(exercise,S,context),...options}
  const now=options.now || new Date(),today=isoOf(now)
  if(['streak','consistency'].includes(id)&&!validDate(settings.anchor??today))throw Error('Choose a valid date range.')
  const anchor=new Date((settings.anchor??today)+'T12:00:00')
  if(id==='streak')return streakReportPages(S,{...options,...settings,now,anchor,period:settings.period||'this-week',format:'pdf'}).map(page=>({...page,imageType:'JPEG',fullPage:false}))
  if(id==='consistency')return calendarReportPages(S,anchor,settings.period||'month','pdf',{...options,now}).map(page=>({...page,imageType:'JPEG',fullPage:false}))
  if(id==='progress')return (await buildProgressPages(buildProgressReport(S,{...settings,now}),options)).map(page=>({...page,fullPage:true}))
  if(id==='stats'){
    const bodyGeometry=!settings.sections||settings.sections.some(id=>['muscles','measurements'].includes(id))?await loadBodyGeometry():undefined
    return statsReportPages(S,{...options,...settings,now,bodyGeometry})
  }
  throw Error('Unknown report')
}
export async function buildDashboardReports(S, ids, settings = {}, options = {}, build = buildDashboardReportPages) {
  const selection=PDF_REPORT_EXPORTS.map(([id])=>id).filter(id=>ids.includes(id))
  if(!selection.length)throw Error('Select at least one report.')
  const pages=[]
  for(const id of selection)pages.push(...await build(id,S,settings[id],options))
  const name=`TGym-Reports-${isoOf(options.now||new Date())}${selection.length===1?'-'+selection[0]:''}.pdf`
  const file=await reportPagesFile(pages,name,{title:'TGym Reports'})
  return [{id:'reports',reportIds:selection,...file}]
}
export async function buildReportFile(id, S, settings = {}, options = {}) {
  options={name:(exercise,context)=>exerciseNameFor(exercise,S,context),...options}
  const now = options.now || new Date(), today = isoOf(now)
  if (['streak','consistency'].includes(id) && !validDate(settings.anchor ?? today)) throw Error('Choose a valid date range.')
  const date = new Date((settings.anchor ?? today)+'T12:00:00')
  if(id==='streak')return buildCalendarExport(S,date,settings.period || 'this-week',settings.format || 'pdf',{...options,...settings,now})
  if(id==='consistency')return buildConsistencyExport(S,date,settings.period || 'month',settings.period === 'full' ? 'pdf' : settings.format || 'pdf',{...options,now})
  if(id==='progress')return buildProgressFile(buildProgressReport(S,{...settings,now}),options)
  if(id==='stats')return {name:`tgym-stats-${today}.html`,blob:new Blob([statsReportHTML(S)],{type:'text/html;charset=utf-8'})}
  if(id==='history')return {name:`TGym-history-${today}.csv`,blob:new Blob([historyCsv(S,{...settings,now:now.getTime()})],{type:'text/csv;charset=utf-8'})}
  if(id==='plan')return {name:`framegym-plan-${today}.json`,blob:new Blob([JSON.stringify(buildPlanBundle(S),null,2)],{type:'application/json'})}
  if(id==='backup')return {name:`TGym-full-backup-${today}.json`,blob:new Blob([JSON.stringify(createBackup(S,now),null,2)],{type:'application/json'})}
  throw Error('Unknown report')
}
export async function buildSelectedReports(S, ids, settings = {}, options = {}, build = buildReportFile) {
  if(options.combinePDF)return buildDashboardReports(S,ids,settings,options)
  const selection = selectedReports(ids)
  if(!selection.length)throw Error('Select at least one report.')
  const files=[]
  for(const id of selection) {
    const file=await build(id,S,settings[id],options)
    if(!file.blob?.size)throw Error('Empty report')
    files.push({id,...file})
  }
  return files
}
export async function saveSelectedReports(files, ids, save = saveReportFile) {
  const selection=selectedReports(ids), results=[]
  const chosen=files.filter(file=>file.id==='reports'?file.reportIds?.length&&file.reportIds.every(id=>selection.includes(id)):selection.includes(file.id))
  if(MOBILE && chosen.length>1 && save===saveReportFile) {
    try { await saveReportBatch(chosen);return chosen.map(({id})=>({id,status:'saved'})) }
    catch(error) { return chosen.map(({id})=>({id,status:error?.name==='AbortError'||error?.message==='Share canceled'?'canceled':'failed'})) }
  }
  // Save sequentially, including native share sheets. Retain failures for per-file retry.
  for(const file of chosen) {
    try { await save(file); results.push({id:file.id,status:'saved'}) }
    catch(error) { results.push({id:file.id,status:error?.name==='AbortError'||error?.message==='Share canceled'?'canceled':'failed'}) }
  }
  return results
}
