import {validateRoutineExchange,applyRoutineExchange,routineExchangeReviewKey,exchangeCatalogue,routineExchangeRows} from './routine-exchange.js'
import {routineIds} from './daily-plan.js'

const clone=value=>structuredClone(value)
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)
const canonical=value=>Array.isArray(value)?value.map(canonical):object(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b))
const issue=message=>({sheet:'Rutinas',row:0,field:'Selección',message})

/** User-facing recovery text; original messages remain in technical details. */
export function routineImportIssueText(item,t) {
  const message=String(item?.message||'')
  if(['Select at least one routine to import.','Select only routines present in this file.','Two selected routines cannot replace the same existing routine. Keep or copy one before importing.'].includes(message))return t(message)
  const numeric=/Expected (integer|number) between ([\d.]+) and ([\d.]+)/.exec(message)
  if(numeric)return t(numeric[1]==='integer'?'Use a whole number between {0} and {1}.':'Use a number between {0} and {1}.',numeric[2],numeric[3])
  if(/Invalid JSON|damaged or incomplete/i.test(message))return t('The file is incomplete or is not valid JSON. Export it again from TGym without changing its format.')
  if(/15 MiB|exceeds .*MiB/i.test(message))return t('The transfer exceeds the 15 MiB limit. Export fewer selected routines while retaining their required resources.')
  if(/Unsupported format version|unsupported.*version/i.test(message))return t('This format version is not supported. Export the routines again with a compatible TGym version.')
  if(/unit must|load unit|weight unit|source.*unit|Unit must/i.test(message))return t('The file must declare kg or lb and its exercise load units must match. For a legacy file, choose its original unit explicitly.')
  if(/unsafe|private fields|credentials/i.test(message))return t('This field contains an unsafe identity or private metadata. Obtain a new TGym export without credentials or device-local data.')
  if(/Remove performed|Workout results are not/i.test(message))return t('This file contains workout results. Use full-backup import for history and a routine-only export for prescriptions.')
  if(/portable definition|complete custom|full custom|original metadata|source preference|original source rest|source deload/i.test(message))return t('Restore the required source metadata from the original TGym export. Missing exercise definitions or preference values cannot be guessed.')
  if(/embedded|media|resources|public HTTPS/i.test(message))return t('An exercise resource is missing or cannot be transferred. Restore its original definition and media, or use a permanent public HTTPS URL.')
  if(/Duplicate.*ID|cannot replace a built-in ID|safe ID|Unknown or duplicate routine reference/i.test(message))return t('Restore unique stable routine and exercise IDs from the original export. Names and nicknames cannot replace identities.')
  if(/Routine order/i.test(message))return t('The order must include each routine ID exactly once. Restore the original routine order.')
  if(/Add the prescribed|Add the exercise prescription|missing values.*zero/i.test(message))return t('Restore the prescribed sets and rep or time targets from the original export. Missing values are not zero.')
  if(/Minimum exceeds maximum/i.test(message))return t('The minimum cannot exceed the maximum. Correct the indicated rep or RIR range using the original prescription.')
  if(/boolean/i.test(message))return t('Use a true or false value for this option, as recorded in the original export.')
  if(/text array|text.*array/i.test(message))return t('Use an array of text values for this field, as recorded in the original export.')
  if(/must be text|Alias must be text|must be a string/i.test(message))return t('Use text for this field and preserve the original note or nickname.')
  if(/valid date|start date|startDate|Invalid schedule key/i.test(message))return t('Use a valid date in YYYY-MM-DD format. An enabled deload cycle must retain its original start date.')
  if(/Superset/i.test(message))return t('A superset needs at least two consecutive exercises with the same group ID. Restore their original order and grouping.')
  if(/exact original name|same ID and exact original name/i.test(message))return t('Restore the catalogue name and ID exactly. Put a display nickname in the nickname field.')
  if(/Unknown|Choose|Use same or increased|supported/i.test(message))return t('Choose a supported TGym option for this field. If it is unknown, restore the original configuration before importing.')
  if(/worksheet|sheet|workbook/i.test(message))return t('The workbook structure is incomplete or incompatible. Use the TGym template and retain its metadata sheets.')
  return t('This field could not be validated. Correct its indicated value using the original TGym export, then select the file again.')
}

/** Scope only after the original complete file has passed structural validation. */
export function scopeRoutineImport(raw,selectedIds) {
  const data=clone(typeof raw==='string'?JSON.parse(raw):raw), selected=new Set(selectedIds)
  const routines=Array.isArray(data.routines)?data.routines.filter(r=>selected.has(r.id)):[]
  const order=Array.isArray(data.routineOrder)?data.routineOrder.filter(id=>selected.has(id)):routines.map(r=>r.id)
  const byId=new Map(routines.map(r=>[r.id,r]))
  data.routines=order.map(id=>byId.get(id)).filter(Boolean)
  if(Object.hasOwn(data,'routineOrder'))data.routineOrder=order
  const used=new Set(data.routines.flatMap(r=>r.ex.map(ex=>ex.id)))
  if(Array.isArray(data.catalog))data.catalog=data.catalog.filter(ex=>used.has(ex.id))
  if(Array.isArray(data.customEx))data.customEx=data.customEx.filter(ex=>used.has(ex.id))
  for(const field of ['week','dayPlan']) if(object(data[field])) data[field]=Object.fromEntries(Object.entries(data[field]).map(([key,value])=>[key,routineIds(value).filter(id=>selected.has(id))]))
  return data
}

const safeChoice=conflict=>conflict.kind==='unit'?'convert':conflict.allowedChoices.includes('keep')?'keep':conflict.allowedChoices[0]
function scheduleSummary(S,draft,enabled,importedIds) {
  const changes=[],conflicts=[]
  if(enabled&&draft)for(const field of ['week','dayPlan'])for(const key of new Set([...Object.keys(S[field]||{}),...Object.keys(draft[field]||{})])){
    const beforeIds=routineIds(S[field]?.[key]),afterIds=routineIds(draft[field]?.[key])
    if(equal(beforeIds,afterIds))continue
    const addedIds=afterIds.filter(id=>!beforeIds.includes(id)),removedIds=beforeIds.filter(id=>!afterIds.includes(id))
    changes.push({field,key,beforeIds,afterIds,addedIds,removedIds})
    const existingIds=beforeIds.filter(id=>!importedIds.includes(id)),incoming=afterIds.filter(id=>importedIds.includes(id))
    if(existingIds.length&&incoming.length)conflicts.push({field,key,existingIds,importedIds:incoming,combinedIds:afterIds})
  }
  return {enabled,changes,conflicts}
}

/** One deterministic preparation owns both the final preview and import draft. */
export function prepareRoutineImport(raw,S,options={}) {
  const {exerciseMappings={},legacyUnit,locations,schedule=false,acceptAdaptations=false,fileErrors=[]}=options
  const fullValidation=validateRoutineExchange(raw,S,{legacyUnit,locations})
  const fullErrors=[...fileErrors,...fullValidation.errors]
  const source=fullValidation.sourceData||fullValidation.data||raw
  const available=Array.isArray(source?.routines)?source.routines.filter(r=>object(r)&&typeof r.id==='string').map(r=>r.id):[]
  const requested=Array.isArray(options.selectedIds)?options.selectedIds:available
  const selectedIds=available.filter(id=>requested.includes(id))
  const errors=[...fullErrors]
  if(requested.some(id=>!available.includes(id)))errors.push(issue('Select only routines present in this file.'))
  if(!selectedIds.length)errors.push(issue('Select at least one routine to import.'))
  const scoped=fullErrors.length?null:scopeRoutineImport(source,selectedIds)
  const initial=scoped?(selectedIds.length===available.length&&!Object.keys(exerciseMappings).length?fullValidation:validateRoutineExchange(scoped,S,{exerciseMappings,legacyUnit,locations})):null
  const selectedRoutines=Array.isArray(scoped?.routines)?scoped.routines:[]
  const routineConflicts=new Map((initial?.conflicts||[]).filter(c=>c.kind==='routine').map(c=>[c.id,c]))
  const reservations=JSON.parse(routineExchangeReviewKey(S)).reservations.routines
  // An unknown exercise must not hide a known routine-ID collision. Such a
  // duplicate can be kept without mapping or importing any of its exercises.
  for(const routine of selectedRoutines)if(!routineConflicts.has(routine.id)){
    const existing=(S.routines||[]).find(r=>r.id===routine.id),sameNameIds=(S.routines||[]).filter(r=>r.name===routine.name&&r.id!==routine.id).map(r=>r.id),reserved=reservations.includes(routine.id)&&!existing
    if(existing||sameNameIds.length||reserved){
      const existingId=existing?.id||(!reserved&&sameNameIds.length===1?sameNameIds[0]:undefined)
      routineConflicts.set(routine.id,{key:`routine:${routine.id}`,kind:'routine',id:routine.id,name:routine.name,existingId,sameNameIds,semanticIds:[],reserved,allowedChoices:existingId?['keep','copy','replace']:['keep','copy']})
    }
  }
  const choices={...Object.fromEntries([...routineConflicts.values()].map(c=>[c.key,safeChoice(c)])),...(options.conflicts||{})}
  let validation=initial||fullValidation,acceptedPayload=null,acceptedValidation=null,acceptedMappings={}
  // Newly discovered semantic duplicates also default to keep. Re-scope until
  // that accepted set is stable so skipped data never forces an import choice.
  for(let pass=0;scoped&&pass<=selectedRoutines.length;pass++){
    const acceptedIds=selectedRoutines.filter(r=>choices[`routine:${r.id}`]!=='keep').map(r=>r.id)
    if(!acceptedIds.length){acceptedPayload=null;acceptedValidation=null;break}
    acceptedPayload=scopeRoutineImport(scoped,acceptedIds)
    const used=new Set(acceptedPayload.routines.flatMap(r=>r.ex.map(ex=>ex.id)))
    acceptedMappings=Object.fromEntries(Object.entries(exerciseMappings).filter(([id])=>used.has(id)))
    const unitChoice=choices.unit
    acceptedValidation=validateRoutineExchange(acceptedPayload,S,{exerciseMappings:acceptedMappings,legacyUnit,locations,conflicts:choices})
    let changed=false
    for(const conflict of acceptedValidation.conflicts||[]){
      if(conflict.kind==='routine')routineConflicts.set(conflict.id,conflict)
      if(choices[conflict.key]==null){choices[conflict.key]=safeChoice(conflict);if(conflict.kind==='routine'&&choices[conflict.key]==='keep')changed=true}
    }
    if(!changed){
      if(unitChoice!==choices.unit)acceptedValidation=validateRoutineExchange(acceptedPayload,S,{exerciseMappings:acceptedMappings,legacyUnit,locations,conflicts:choices})
      break
    }
  }
  const relevantConflicts=[...routineConflicts.values(),...(acceptedValidation?.conflicts||[]).filter(c=>c.kind!=='routine')]
  validation={...(acceptedValidation||initial||fullValidation),conflicts:relevantConflicts,unresolved:acceptedValidation?.unresolved||[],adaptations:acceptedValidation?.adaptations||[],notices:acceptedValidation?.notices||[]}
  const invalidChoices=relevantConflicts.filter(conflict=>!conflict.allowedChoices.includes(choices[conflict.key]))
  for(const error of acceptedValidation?.errors||[])if(!errors.some(existing=>equal(existing,error)))errors.push(error)
  const summary={newCount:0,replaceCount:0,keepCount:0,copyCount:0,customCount:0,units:{source:validation.sourceUnit||validation.data?.unit,destination:S.unit||'kg',converted:choices.unit==='convert'&&validation.sourceUnit!==(S.unit||'kg')}}
  for(const routine of selectedRoutines){
    const conflict=routineConflicts.get(routine.id),action=conflict?choices[conflict.key]:'new'
    if(action==='new')summary.newCount++
    else if(['replace','keep','copy'].includes(action))summary[`${action}Count`]++
  }
  const effectiveCount=summary.newCount+summary.replaceCount+summary.copyCount
  let draft=null,transformError=null,preview={routines:[],catalog:[],unit:S.unit||'kg',rows:[],data:null}
  if(acceptedPayload&&validation.valid&&!errors.length&&!invalidChoices.length&&effectiveCount){
    try{
      const applied=applyRoutineExchange(S,validation,{conflicts:choices,schedule,acceptAdaptations:true,exerciseMappings:acceptedMappings,legacyUnit,returnDetails:true})
      draft=applied.state
      const importedIds=(validation.data.routineOrder||validation.data.routines.map(r=>r.id)).map(id=>applied.routineIdMap[id]).filter(Boolean)
      const routines=importedIds.map(id=>draft.routines.find(r=>r.id===id)).filter(Boolean)
      const used=new Set(routines.flatMap(r=>r.ex.map(ex=>ex.id)))
      const catalog=exchangeCatalogue(draft).filter(ex=>used.has(ex.id))
      const data={...validation.data,routines,routineOrder:importedIds,catalog,unit:draft.unit||'kg'}
      preview={routines,catalog,unit:data.unit,rows:routineExchangeRows(data).Series,data}
      summary.customCount=(draft.customEx||[]).length-(S.customEx||[]).length
      summary.schedule=scheduleSummary(S,draft,schedule,importedIds)
    }catch(error){transformError=error;errors.push(issue(error.message))}
  }
  summary.schedule||=scheduleSummary(S,null,schedule,[])
  // Kept routines cannot cause adaptations or catalogue writes in this import.
  const adaptations=acceptedValidation?.adaptations||[],notices=acceptedValidation?.notices||[]
  const warnings=options.warnings||[]
  const requiredAdaptations=[...adaptations,...(effectiveCount?warnings:[])]
  const canImport=!!draft&&effectiveCount>0&&validation.valid&&!errors.length&&!invalidChoices.length&&(!requiredAdaptations.length||acceptAdaptations)
  return {fullValidation,fullErrors:errors,validation,choices,selectedIds,adaptations:requiredAdaptations,notices,effectiveCount,summary,preview,draft,canImport,transformError,reviewKey:routineExchangeReviewKey(S),source,options:{...options,selectedIds,conflicts:choices}}
}

/** Revalidate a reviewed import against live state without copying stale history. */
export function commitRoutineImport(current,review) {
  if(review.reviewKey!==routineExchangeReviewKey(current))throw new Error('Your plan changed during review. Review the current conflicts again before importing.')
  const checked=prepareRoutineImport(review.source,current,review.options)
  if(!checked.canImport)throw new Error('Resolve all errors and review the import before saving.')
  if(!equal(checked.preview.data,review.preview.data)||!equal(checked.summary,review.summary))throw new Error('Your plan changed during review. Review the current conflicts again before importing.')
  return checked.draft
}
