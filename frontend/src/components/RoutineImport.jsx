import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { nav } from '../lib/nav.js'
import { readRoutineExchangeFile, buildRoutineExchangeFile, exchangeCatalogue, routineExchangeReviewKey, routineExchangeRows } from '../lib/routine-exchange.js'
import { prepareRoutineImport, commitRoutineImport, routineImportIssueText } from '../lib/routine-import.js'
import { routineAdaptationMessage, routineImportDiagnostics, routineImportFailureMessage } from '../lib/routine-import-feedback.js'
import { displayReps } from '../lib/history.js'
import { DAYN, fmtWeight } from '../lib/format.js'
import { exerciseNameFor, originalExerciseNameFor } from '../lib/i18n-core.js'
import { saveReportFile } from '../lib/report-file.js'
import { Capacitor } from '@capacitor/core'
import { Button } from './ui.jsx'

const record = value => value && typeof value === 'object' && !Array.isArray(value)
const catalogueOf = value => Array.isArray(value) ? value.filter(record) : []
const routinesOf = data => Array.isArray(data?.routines) ? data.routines.filter(record) : []
const sourceNameState = (catalog, mode) => ({ exerciseNameMode: mode || 'aliases', customEx: catalog.filter(ex=>ex.custom).map(ex=>record(ex.definition)?ex.definition:ex), exerciseAliases: Object.fromEntries(catalog.filter(ex=>ex.aliasPresent||ex.alias).map(ex=>[ex.id,ex.alias])) })
const choiceText = value => value === 'keep' ? 'Keep existing' : value === 'replace' ? 'Replace existing' : 'Import a separate copy'
// Background tabs can suspend animation frames. Give visible UI a paint without
// making persistence depend on the browser producing another frame.
const allowStatusPaint = () => new Promise(resolve => {
  let finished = false, first, second
  const finish = () => { if (finished) return; finished = true; clearTimeout(timer); if (first != null) cancelAnimationFrame(first); if (second != null) cancelAnimationFrame(second); resolve() }
  const timer = setTimeout(finish, 100)
  first = requestAnimationFrame(() => { second = requestAnimationFrame(finish) })
})
const prescription = (row, ex) => {
  const [, , type, min, max, weight, unit, rirMin, rirMax, , , pct, rule, automatic, sec, minutes, speed] = row
  const range = (lo,hi) => lo === hi ? String(hi) : `${lo}–${hi}`
  const target = type === 'Warm-up' && min === '' ? t('Automatic warm-up') : sec !== '' ? `${sec} s` : minutes !== '' ? `${minutes} min · ${speed} km/h` : `${range(displayReps(min,ex),displayReps(max,ex))} reps`
  return [target+(ex.side?` · ${t('per side')}`:''),weight!==''&&minutes===''?`${fmtWeight(weight)} ${unit}`:'',rirMin!==''?`RIR ${range(rirMin,rirMax)}`:'',type==='Back-off'?`${pct}% · ${automatic?rule==='increased'?t('Top reps +2'):rule==='same'?t('Same as Top reps'):String(rule):t('Independent reps')}`:''].filter(Boolean).join(' · ')
}
function PrescriptionDetails({ routine, preview, catalog, rows, nameState, blocked }) {
  return <details><summary>{t('Details for {0}',routine.name||routine.id)}</summary>
    {blocked?<p className="small dim">{t('Correct the file errors before previewing prescriptions.')}</p>:<>
      {typeof routine.note==='string'&&routine.note&&<p className="small">{routine.note}</p>}
      {(Array.isArray(preview.ex)?preview.ex:[]).map((ex,i)=>{
        if(!record(ex))return null
        const entry=catalog.find(item=>item.id===ex.id)||{id:ex.id,n:ex.id},name=exerciseNameFor(entry,nameState,{entry:ex}),original=originalExerciseNameFor(entry,nameState,{entry:ex})
        return <div className="routine-exchange-exercise" key={i}>
          <strong className="small">{i+1}. {String(name)}</strong>
          {name!==original&&<p className="small dim">{t('Original name')}: {String(original)}</p>}
          {typeof entry.libraryNote==='string'&&entry.libraryNote&&<p className="small">{entry.libraryNote}</p>}
          {typeof ex.note==='string'&&ex.note&&<p className="small">{ex.note}</p>}
          {typeof ex.sg==='string'&&ex.sg&&<p className="small">{t('Superset')}: {ex.sg}</p>}
          <table className="routine-exchange-series small"><thead><tr><th>{t('Sets')}</th><th>{t('Prescription')}</th><th>{t('Rest')}</th></tr></thead><tbody>{rows.filter(row=>row[0]===`${preview.id}:${i+1}`).map(row=><tr key={row[1]}><td>{row[1]} · {t(row[2])}</td><td>{prescription(row,ex)}</td><td>{row[9]} s</td></tr>)}</tbody></table>
        </div>
      })}
    </>}
  </details>
}

export default function RoutineImport({ close, onSaving }) {
  const S=useStore(s=>s.S), updateAtomic=useStore(s=>s.updateAtomic)
  const [step,setStep]=useState('file'),[file,setFile]=useState(null),[selectedIds,setSelectedIds]=useState([])
  const [choices,setChoices]=useState({}),[mappings,setMappings]=useState({}),[legacyUnit,setLegacyUnit]=useState('')
  const [schedule,setSchedule]=useState(false),[accepted,setAccepted]=useState(false),[replaceConfirmed,setReplaceConfirmed]=useState(false)
  const [busy,setBusy]=useState(false),[error,setError]=useState(null),[success,setSuccess]=useState(null),[template,setTemplate]=useState(null),[preparingTemplate,setPreparingTemplate]=useState(false)
  const input=useRef(null),heading=useRef(null),mounted=useRef(true),generation=useRef(0),working=useRef(false),priorKey=useRef(null)
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++}},[])
  useEffect(()=>{heading.current?.focus();heading.current?.closest('.sheet')?.scrollTo?.({top:0})},[step])
  const catalogue=useMemo(()=>exchangeCatalogue(S),[S]),reviewKey=routineExchangeReviewKey(S)
  useEffect(()=>{if(priorKey.current&&priorKey.current!==reviewKey&&!success){setChoices({});setAccepted(false);setReplaceConfirmed(false)};priorKey.current=reviewKey},[reviewKey,success])
  const review=useMemo(()=>file?prepareRoutineImport(file.data,S,{selectedIds,conflicts:choices,exerciseMappings:mappings,legacyUnit,schedule,acceptAdaptations:accepted,locations:file.locations,fileErrors:file.errors||[],warnings:file.warnings||[]}):null,[file,S,selectedIds,choices,mappings,legacyUnit,schedule,accepted])
  const validation=review?.validation,errors=review?.fullErrors||[],routines=routinesOf(file?.data),effectiveChoices=review?.choices||choices,conflicts=validation?.conflicts||[],adaptations=review?.adaptations||[]
  const count=review?.effectiveCount||0,replacing=conflicts.some(c=>effectiveChoices[c.key]==='replace'),canContinue=review?.canImport&&(!replacing||replaceConfirmed)
  const changed=()=>{setAccepted(false);setReplaceConfirmed(false);setError(null)}
  const chooseFile=async event=>{
    const chosen=event.target.files?.[0];event.target.value='';if(!chosen||working.current)return
    const epoch=++generation.current;working.current=true;setBusy(true);setStep('file');setFile(null);setTemplate(null);setSuccess(null);setError(null);setChoices({});setMappings({});setLegacyUnit('');setSchedule(false);setAccepted(false);setReplaceConfirmed(false);setSelectedIds([])
    try{const parsed=await readRoutineExchangeFile(chosen);if(mounted.current&&epoch===generation.current){setFile({...parsed,name:chosen.name,bytes:chosen.size});setSelectedIds(routinesOf(parsed.data).map(r=>r.id));setStep('review')}}
    catch(cause){if(mounted.current&&epoch===generation.current)setError({...routineImportFailureMessage(cause,'read',t),details:routineImportDiagnostics(cause,{stage:'read',file:chosen.name,fileBytes:chosen.size})})}
    finally{if(epoch===generation.current){working.current=false;if(mounted.current)setBusy(false)}}
  }
  const prepareTemplate=async()=>{
    if(working.current)return
    const epoch=++generation.current;working.current=true;setBusy(true);setPreparingTemplate(true);setError(null)
    try{const next=await buildRoutineExchangeFile(S,[],'xlsx',{template:true});if(mounted.current&&epoch===generation.current)setTemplate(next)}
    catch(cause){if(mounted.current&&epoch===generation.current)setError({message:t('Could not export. Try again.'),details:routineImportDiagnostics(cause,{stage:'template'})})}
    finally{if(epoch===generation.current){working.current=false;if(mounted.current){setBusy(false);setPreparingTemplate(false)}}}
  }
  const save=async()=>{
    if(working.current||!canContinue)return
    const captured=review;working.current=true;setBusy(true);setStep('saving');setError(null);onSaving?.(true);let transformed=false
    try{await allowStatusPaint();await updateAtomic(current=>{Object.assign(current,commitRoutineImport(current,captured));transformed=true},true,false);if(mounted.current){setSuccess({count:captured.effectiveCount});setStep('success')}}
    catch(cause){if(mounted.current){const stage=transformed?'persist':'conversion',ios=/(?:iPhone|iPad).*?OS ([\d_]+)/.exec(navigator.userAgent||'')?.[1]?.replaceAll('_','.');setError({...routineImportFailureMessage(cause,stage,t),details:routineImportDiagnostics(cause,{stage,file:file.name,fileBytes:file.bytes,normalizedBytes:new TextEncoder().encode(JSON.stringify(captured.preview.data)).length,sourceUnit:captured.summary.units.source,destinationUnit:S.unit,appVersion:typeof __APP_VERSION__==='undefined'?'unknown':__APP_VERSION__,runtime:Capacitor.isNativePlatform()?'Capacitor':navigator.standalone===true||window.matchMedia?.('(display-mode: standalone)').matches?'installed PWA':'browser tab',...(ios?{ios}:{}),userAgent:navigator.userAgent})});setStep('import')}}
    finally{working.current=false;onSaving?.(false);if(mounted.current)setBusy(false)}
  }
  const daysFor=routine=>Object.entries(file?.data?.week||{}).filter(([,ids])=>(Array.isArray(ids)?ids:[ids]).includes(routine.id)).map(([day])=>t(DAYN[Number(day)]||day)).join(' · ')
  const acceptedRoutines=routinesOf(validation?.data).filter(r=>effectiveChoices[`routine:${r.id}`]!=='keep')
  const acceptedIds=new Set(acceptedRoutines.map(r=>r.id)),hasSchedule=['week','dayPlan'].some(field=>Object.values(file?.data?.[field]||{}).some(ids=>(Array.isArray(ids)?ids:[ids]).some(id=>acceptedIds.has(id))))
  useEffect(()=>{if(!hasSchedule&&schedule)setSchedule(false)},[hasSchedule,schedule])
  const routineName=id=>review?.draft?.routines?.find(r=>r.id===id)?.name||S.routines?.find(r=>r.id===id)?.name||id
  const conflictMeaning=c=>c.existingId===c.id?'This routine ID already exists':c.semanticIds?.length?'Equivalent prescription already exists':c.sameNameIds?.length?'Same name, different routine identity':c.reserved?'This ID is referenced by your history or calendar':'Choose the intended import action'
  const previewFor=routine=>{const index=acceptedRoutines.findIndex(r=>r.id===routine.id);return review?.preview?.routines?.[index]||routinesOf(review?.fullValidation?.data).find(r=>r.id===routine.id)||routine}
  const fallbackRows=useMemo(()=>{try{return file&&!errors.length?routineExchangeRows(review.fullValidation.data).Series:[]}catch{return[]}},[file,review])
  const title=step==='file'?'Choose your routine file':step==='review'?'Review routines':step==='import'?'Ready to import':step==='saving'?'Importing routines':'Import complete'
  return <section className="routine-import-wizard" data-step={step} aria-label={t('Import routines')} aria-busy={busy}>
    <ol className="routine-import-steps" aria-label={t('Import progress')}>{['File','Review','Import'].map((label,i)=><li key={label} aria-current={step===['file','review','import'][i]?'step':undefined}><span>{i+1}</span>{t(label)}</li>)}</ol>
    <h4 ref={heading} tabIndex={-1}>{t(title)}</h4>
    {error&&<div className="routine-import-errors" role="alert"><p>{error.message}</p>{['quota','permission'].includes(error.kind)&&<p className="small">{t('Keep this review open to retry, or cancel. You can export a full backup from Settings. Check browser storage restrictions and available device storage before trying again.')}</p>}<details className="routine-exchange-diagnostics"><summary>{t('Technical details')}</summary><pre className="small">{JSON.stringify(error.details,null,2)}</pre></details></div>}
    {errors.length>0&&<div className="routine-import-errors" role="alert"><strong>{t('Fix these errors before importing:')}</strong><p className="small">{t('The complete file is checked. Correct every error before continuing.')}</p><ul>{errors.map((item,i)=><li key={i}>{routineImportIssueText(item,t)} <small>{item.sheet} {item.row?`#${item.row}`:''} · {item.field}</small></li>)}</ul><details><summary>{t('Technical details')}</summary><pre className="small">{JSON.stringify(errors,null,2)}</pre></details></div>}
    <input ref={input} type="file" hidden accept=".xlsx,.json,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={chooseFile}/>
    {step==='file'&&<div className="routine-import-file"><div className="routine-import-file-icon" aria-hidden="true">↥</div><p>{t('Choose a TGym JSON or Excel file to review its routines before adding them.')}</p><p className="small dim">TGym JSON (.json) / Excel (.xlsx)</p><p className="small dim">{t('Your existing workouts and preferences are preserved.')}</p><Button variant="primary" disabled={busy} onClick={()=>input.current?.click()}>{t('Select file')}</Button><Button disabled={busy} onClick={prepareTemplate}>{t('Download Excel template')}</Button>{template&&<Button disabled={busy} onClick={async()=>{try{await saveReportFile(template)}catch(cause){setError({message:t('Could not save. Download again.'),details:routineImportDiagnostics(cause,{stage:'download'})})}}}>{t('Download')}</Button>}{file&&<p className="small">{file.name} · {Math.ceil(file.bytes/1024)} KB</p>}{busy&&<p role="status">{t(preparingTemplate?'Preparing Excel template…':'Reading routine file…')}</p>}</div>}
    {(step==='review'||step==='import')&&file&&<>
      <div className="routine-import-file-summary"><span>{file.name}</span><small>{Math.ceil(file.bytes/1024)} KB · {t('File unit: {0} · This device: {1}',validation?.sourceUnit||t('Not recorded'),S.unit||t('Not recorded'))}</small>{step==='review'&&<button type="button" className="routine-import-link" onClick={()=>input.current?.click()}>{t('Change file')}</button>}</div>
      {step==='review'&&<>
        <div className="routine-import-selection"><strong>{t('{0} routines selected',selectedIds.length)}</strong><button type="button" className="routine-import-link" onClick={()=>{setSelectedIds(selectedIds.length===routines.length?[]:routines.map(r=>r.id));changed()}}>{t(selectedIds.length===routines.length?'Deselect all':'Select All')}</button></div>
        <div className="routine-import-cards">{routines.map((routine,index)=>{const included=selectedIds.includes(routine.id),preview=previewFor(routine),isFinal=review?.preview?.routines?.includes(preview),catalog=catalogueOf(isFinal?review.preview.catalog:(review?.fullValidation?.data?.catalog||file.data?.catalog)),rows=isFinal?review.preview.rows:fallbackRows,nameState=isFinal?review.draft:sourceNameState(catalog,file.data?.exerciseNameMode);return <article className={'routine-import-card'+(included?' selected':'')} key={`${routine.id}-${index}`}>
          <label className="routine-import-card-title"><input type="checkbox" aria-label={t('Include {0}',routine.name||routine.id)} checked={included} onChange={event=>{const checked=event.target.checked;setSelectedIds(old=>checked?[...old,routine.id]:old.filter(id=>id!==routine.id));changed()}}/><span><strong>{String(routine.name||routine.id||'')}</strong><small>{t('{0} exercises',Array.isArray(routine.ex)?routine.ex.length:0)}{daysFor(routine)?` · ${daysFor(routine)}`:''}</small></span></label>
          <PrescriptionDetails routine={routine} preview={preview} catalog={catalog} rows={rows} nameState={nameState} blocked={errors.length>0}/>
        </article>})}</div>
        {validation?.needsLegacyUnit&&<label><span>{t('Source weight unit of the legacy file')}</span><select className="input" aria-label={t('Source weight unit of the legacy file')} value={legacyUnit} onChange={event=>{setLegacyUnit(event.target.value);changed()}}><option value="">{t('Choose how to import')}</option><option value="kg">kg</option><option value="lb">lb</option></select></label>}
        {conflicts.some(c=>c.kind==='unit')&&<div className="routine-import-decision"><strong>{t('Weight units')}</strong><p className="small">{t('Weights are previewed in {0}. The source file stays unchanged.',effectiveChoices.unit==='convert'?S.unit:validation.sourceUnit)}</p><label className="routine-exchange-choice"><input type="checkbox" aria-label={t('Convert weights to {0}',S.unit)} checked={effectiveChoices.unit==='convert'} onChange={event=>{const value=event.target.checked?'convert':'';setChoices(old=>({...old,unit:value}));changed()}}/>{t('Convert weights to {0}',S.unit)}</label></div>}
        {(validation?.unresolved||[]).map(item=><label key={item.id}><span>{t('Map unknown exercise: {0}',item.name)}</span><select className="input" aria-label={t('Map unknown exercise: {0}',item.name)} value={mappings[item.id]||''} onChange={event=>{const value=event.target.value;setMappings(old=>({...old,[item.id]:value}));changed()}}><option value="">{t('Choose an exercise')}</option>{catalogue.map(ex=><option key={ex.id} value={ex.id}>{ex.selector}</option>)}</select></label>)}
        {conflicts.filter(c=>c.kind!=='unit').map(c=><div className="routine-import-decision" key={c.key}><label><span>{t('Conflict: {0}',c.name)}</span><select className="input" aria-label={t('Conflict: {0}',c.name)} value={effectiveChoices[c.key]||''} onChange={event=>{const value=event.target.value;setChoices(old=>({...old,[c.key]:value}));changed()}}><option value="">{t('Choose how to import')}</option>{(c.allowedChoices||[]).map(value=><option key={value} value={value}>{t(choiceText(value))}</option>)}</select></label>{c.kind==='routine'&&<p className="small dim">{t(conflictMeaning(c))}</p>}{c.canMap&&<label><span>{t('Choose an existing exercise instead')}</span><select className="input" aria-label={t('Choose an existing exercise instead')} value={mappings[c.sourceId]||''} onChange={event=>{const value=event.target.value;setMappings(old=>({...old,[c.sourceId]:value}));changed()}}><option value="">{t('Choose an exercise')}</option>{catalogue.map(ex=><option key={ex.id} value={ex.id}>{ex.selector}</option>)}</select></label>}</div>)}
        {replacing&&<label className="routine-exchange-choice"><input type="checkbox" aria-label={t('I confirm replacing the selected existing data')} checked={replaceConfirmed} onChange={event=>setReplaceConfirmed(event.target.checked)}/>{t('I confirm replacing the selected existing data')}</label>}
        {hasSchedule&&<div className="routine-import-decision"><label className="routine-exchange-choice"><input type="checkbox" aria-label={t('Apply imported schedule (preserves other routines)')} checked={schedule} onChange={event=>{setSchedule(event.target.checked);changed()}}/>{t('Apply imported schedule (preserves other routines)')}</label><p className="small dim">{t('Leave this off to add routines without changing your calendar.')}</p>{schedule&&<p className="small">{t('{0} calendar days will be updated. Existing unrelated routines stay scheduled.',review?.summary?.schedule?.changes?.length||0)}</p>}{schedule&&(review?.summary?.schedule?.changes||[]).map((item,i)=><p className="small" key={i}>{t('Calendar on {0}: {1}',item.field==='week'?t(DAYN[Number(item.key)]||item.key):item.key,item.afterIds.map(routineName).join(' + ')||t('Rest'))}</p>)}</div>}
        {adaptations.length>0&&<div className="routine-import-decision"><strong>{t('Review the settings that differ on this device:')}</strong><ul>{adaptations.map((item,i)=><li key={item.key||i}>{routineAdaptationMessage(item,t)}</li>)}</ul><label className="routine-exchange-choice"><input type="checkbox" aria-label={t('I accept these adaptations for this import')} checked={accepted} onChange={event=>setAccepted(event.target.checked)}/>{t('I accept these adaptations for this import')}</label></div>}
        {(review?.notices||[]).length>0&&<details className="routine-import-notices"><summary>{t('Prescription settings')}</summary><ul>{review.notices.map((item,i)=><li key={item.key||i}>{routineAdaptationMessage(item,t)}</li>)}</ul></details>}
      </>}
      {step==='review'&&selectedIds.length>0&&!count&&!errors.length&&<p role="status">{t('No routines will be imported with the current choices. Choose a copy or replacement to continue.')}</p>}
      {step==='import'&&<div className="routine-import-summary"><div className="routine-import-count">{count}</div><strong>{t('{0} routines ready to import',count)}</strong><dl>{[['New routines',(review?.summary?.newCount||0)+(review?.summary?.copyCount||0)],['Replacements',review?.summary?.replaceCount||0],['Custom exercises',review?.summary?.customCount||0],['Weight unit',review?.preview?.unit||S.unit],['Calendar',t(schedule?'Apply imported schedule':'Keep current calendar')]].map(([label,value])=><div key={label}><dt>{t(label)}</dt><dd>{value}</dd></div>)}</dl><p className="small dim">{t('Your existing workouts and preferences are preserved.')}</p></div>}
    </>}
    {step==='saving'&&<div className="routine-import-saving" role="status"><progress aria-label={t('Saving import…')}/><p>{t('Saving your selected routines…')}</p><p className="small dim">{t('Keep TGym open until saving finishes.')}</p></div>}
    {step==='success'&&<div className="routine-import-success" role="status"><div aria-hidden="true">✓</div><p>{t('{0} routines imported successfully.',success?.count||0)}</p><p className="small dim">{t('Your existing workouts and preferences are preserved.')}</p></div>}
    <footer className="routine-import-footer">
      {step==='file'&&<>{file&&<Button variant="primary" disabled={busy} onClick={()=>setStep('review')}>{t('Continue')}</Button>}<Button onClick={()=>{generation.current++;close()}}>{t('Cancel import')}</Button></>}
      {step==='review'&&<><Button disabled={busy} onClick={()=>setStep('file')}>{t('Back')}</Button><Button variant="primary" disabled={busy||!canContinue} onClick={()=>setStep('import')}>{t('Continue')}</Button></>}
      {step==='import'&&<><Button disabled={busy} onClick={()=>setStep('review')}>{t('Back')}</Button><Button variant="primary" disabled={busy||!canContinue} onClick={save}>{t(error?'Retry import':'Import {0} routines',count)}</Button></>}
      {step==='success'&&<><Button onClick={close}>{t('Done')}</Button><Button variant="primary" onClick={()=>{close();nav('/plan')}}>{t('View routines')}</Button></>}
      {(step==='review'||step==='import')&&<Button variant="ghost" className="routine-import-cancel" disabled={busy} onClick={close}>{t('Cancel import')}</Button>}
    </footer>
  </section>
}
