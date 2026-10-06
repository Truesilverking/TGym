import { buildCalendarExport, buildConsistencyExport } from './calendar-file.js'
import { buildProgressReport } from './progress-report.js'
import { buildProgressFile } from './progress-file.js'
import { statsReportHTML } from './stats-report.js'
import { historyCsv } from './history-export.js'
import { buildPlanBundle } from './plan-share.js'
import { createBackup } from './backup.js'
import { saveReportFile, saveReportBatch } from './report-file.js'
import { MOBILE } from './mobile.js'
import { isoOf } from './format.js'
import { validDate } from './training-history.js'

// Each builder owns its content. This registry only selects independent files.
export const REPORT_EXPORTS = [['streak','Streak Report'],['consistency','Consistency Report'],['progress','Progress Report'],['stats','Stats'],['history','Workout history'],['plan','Plan'],['backup','Full backup']]
export function selectedReports(ids) {
  return REPORT_EXPORTS.map(([id])=>id).filter(id=>ids.includes(id))
}
export async function buildReportFile(id, S, settings = {}, options = {}) {
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
  const chosen=files.filter(file=>selection.includes(file.id))
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
