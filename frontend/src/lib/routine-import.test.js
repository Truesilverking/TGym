import {describe,expect,it} from 'vitest'
import {anonymousQuotaExchange} from './routine-import-quota.fixture.js'
import {createRoutineExchange,applyRoutineExchange,validateRoutineExchange} from './routine-exchange.js'
import {prepareRoutineImport,commitRoutineImport,scopeRoutineImport,routineImportIssueText} from './routine-import.js'
import {applyTrainingPlan,withBackoffRepsMode} from './training-plan.js'
import {buildSets} from './history.js'
import {CATALOGUE} from './exercises.js'

const raw=()=>anonymousQuotaExchange({largeMedia:false})
const empty=(unit='lb')=>({unit,routines:[],routineOrder:[],customEx:[],exerciseAliases:{},exNotes:{},week:{},dayPlan:{},daySkipped:{},workouts:[{id:'existing-history',entries:[]}],active:{id:'active-session'},exWeights:{},effort:'rir',backoffRepsMode:'increased',trainingPauses:[]})
const prepared=(data,S,options={})=>prepareRoutineImport(data,S,{acceptAdaptations:true,...options})
const planned=(S,ex)=>applyTrainingPlan(buildSets(S,ex),withBackoffRepsMode(ex,S),ex.loadingStep)

describe('guided routine import preparation and exact preview',()=>{
  it('scopes routines, required catalogue/resources and schedule in original order',()=>{
    const data=raw(),scoped=scopeRoutineImport(data,['quota-routine-3','quota-routine-1'])
    expect(scoped.routineOrder).toEqual(['quota-routine-1','quota-routine-3'])
    expect(scoped.routines.map(r=>r.id)).toEqual(scoped.routineOrder)
    expect(scoped.catalog.every(ex=>scoped.routines.some(r=>r.ex.some(e=>e.id===ex.id)))).toBe(true)
    expect(scoped.catalog.filter(ex=>ex.custom)).toHaveLength(7)
    expect(scoped.week[2]).toEqual([])
    expect(scoped.week[3]).toEqual(['quota-routine-3'])
    expect(data.routines).toHaveLength(6)
  })

  it('shows exactly the prescriptions, units, aliases and resources committed for a selected subset',()=>{
    const data=raw(),S=empty()
    Object.assign(data.catalog.find(ex=>ex.id==='quota-custom-1'),{alias:'Portable nickname',aliasPresent:true})
    S.exerciseAliases={'unrelated-alias':'Preserved nickname'}
    const before=structuredClone(S),review=prepared(data,S,{selectedIds:['quota-routine-3','quota-routine-1']})
    expect(review.canImport).toBe(true)
    expect(review.effectiveCount).toBe(2)
    expect(review.preview.routines.map(r=>r.id)).toEqual(['quota-routine-1','quota-routine-3'])
    const committed=commitRoutineImport(S,review)
    expect(committed).toEqual(review.draft)
    for(const routine of review.preview.routines)expect(committed.routines.find(r=>r.id===routine.id)).toEqual(routine)
    expect(committed.customEx).toHaveLength(7)
    expect(committed.customEx.filter(ex=>ex.img)).toHaveLength(6)
    expect(committed.exerciseAliases).toEqual({'unrelated-alias':'Preserved nickname','quota-custom-1':'Portable nickname'})
    expect(review.preview.catalog.find(ex=>ex.id==='quota-custom-1').alias).toBe('Portable nickname')
    expect(committed.workouts).toEqual(before.workouts)
    expect(committed.active).toEqual(before.active)
    expect(committed.week).toEqual(before.week)
    expect(committed.unit).toBe('lb')
    expect(S).toEqual(before)
  })

  it('shows and saves kept destination nicknames and notes when source metadata conflicts',()=>{
    const data=raw(),S=empty(),source=data.catalog.filter(ex=>ex.custom)
    S.customEx=source.map(ex=>structuredClone(ex.definition))
    S.exerciseAliases={'quota-custom-1':'Destination nickname'};S.exNotes={'quota-custom-1':'Destination note'}
    Object.assign(data.catalog.find(ex=>ex.id==='quota-custom-1'),{alias:'Source nickname',aliasPresent:true,libraryNote:'Source note'})
    const review=prepared(data,S,{selectedIds:['quota-routine-1']})
    expect(review.choices['alias:quota-custom-1']).toBe('keep')
    expect(review.choices['note:quota-custom-1']).toBe('keep')
    expect(review.canImport).toBe(true)
    expect(review.preview.catalog.find(ex=>ex.id==='quota-custom-1')).toMatchObject({alias:'Destination nickname',libraryNote:'Destination note'})
    const saved=commitRoutineImport(S,review)
    expect(saved.exerciseAliases).toEqual(S.exerciseAliases)
    expect(saved.exNotes['quota-custom-1']).toBe('Destination note')
    expect(saved.customEx).toEqual(S.customEx)
  })

  it('blocks intrinsic invalid data anywhere in the original file even when its routine is deselected',()=>{
    const data=raw();data.routines[5].ex[0].sets=0
    const review=prepared(data,empty(),{selectedIds:['quota-routine-1']})
    expect(review.fullErrors.some(error=>error.field==='sets')).toBe(true)
    expect(review.canImport).toBe(false)
    expect(review.draft).toBeNull()
  })

  it.each(['routine','exercise','catalogue','note'])('keeps a malformed %s record recoverable instead of crashing preparation',kind=>{
    const data=raw()
    if(kind==='routine')data.routines[0]=null
    if(kind==='exercise')data.routines[0].ex[0]=null
    if(kind==='catalogue')data.catalog[0]=null
    if(kind==='note')data.routines[0].note={invalid:'object'}
    expect(()=>prepareRoutineImport(data,empty())).not.toThrow()
    const review=prepareRoutineImport(data,empty())
    expect(review.canImport).toBe(false)
    expect(review.fullErrors.length).toBeGreaterThan(0)
    expect(review.preview.routines).toEqual([])
  })

  it('scopes unresolved identity decisions without concealing their full-file existence',()=>{
    const data=raw();data.routines[5].ex[0].id='foreign-unresolved';data.catalog.push({id:'foreign-unresolved',n:'Unknown original',custom:false})
    const review=prepared(data,empty(),{selectedIds:['quota-routine-1']})
    expect(review.fullValidation.unresolved).toHaveLength(1)
    expect(review.validation.unresolved).toEqual([])
    expect(review.canImport).toBe(true)
    expect(review.draft.routines).toHaveLength(1)
  })

  it('defaults to keep duplicates and cannot import zero effective routines',()=>{
    const data=raw(),S=commitRoutineImport(empty(),prepared(data,empty()))
    const review=prepared(data,S)
    expect(review.summary.keepCount).toBe(6)
    expect(review.effectiveCount).toBe(0)
    expect(review.canImport).toBe(false)
    expect(review.draft).toBeNull()
    expect(Object.values(review.choices)).not.toContain('replace')
  })

  it('can keep an existing routine with unknown source exercises while importing another valid routine',()=>{
    const data=raw(),S=empty()
    S.routines=[{id:'quota-routine-1',name:'Existing kept plan',ex:[{id:CATALOGUE[0].id,sets:2,reps:8,weight:20}]}];S.routineOrder=['quota-routine-1']
    data.routines[0].ex[0].id='foreign-unresolved';data.catalog.push({id:'foreign-unresolved',n:'Unknown original',custom:false})
    const review=prepared(data,S,{selectedIds:['quota-routine-1','quota-routine-3'],exerciseMappings:{'foreign-unresolved':'missing-destination'}})
    expect(review.choices['routine:quota-routine-1']).toBe('keep')
    expect(review.validation.unresolved).toEqual([])
    expect(review.fullErrors).toEqual([])
    expect(review.canImport).toBe(true)
    expect(review.effectiveCount).toBe(1)
    expect(review.preview.routines.map(r=>r.id)).toEqual(['quota-routine-3'])
    expect(review.draft.routines[0]).toEqual(S.routines[0])
    expect(review.draft.customEx).toEqual([])
  })

  it('copies a duplicate to the precise generated ID shown in the final preview without duplicating resources',()=>{
    const data=raw(),S=commitRoutineImport(empty(),prepared(data,empty()))
    const review=prepared(data,S,{selectedIds:['quota-routine-1'],conflicts:{'routine:quota-routine-1':'copy'}})
    expect(review.canImport).toBe(true)
    expect(review.summary.copyCount).toBe(1)
    expect(review.preview.routines[0].id).not.toBe('quota-routine-1')
    expect(review.preview.rows.every(row=>row[0].startsWith(review.preview.routines[0].id+':'))).toBe(true)
    expect(commitRoutineImport(S,review).routines.at(-1)).toEqual(review.preview.routines[0])
    expect(review.summary.customCount).toBe(0)
  })

  it('blocks two source routines replacing the same target, with no unrelated routine in the preview',()=>{
    const S=empty(),known=CATALOGUE[0].id
    S.routines=[{id:'target',name:'Shared name',ex:[{id:known,sets:2,reps:8,weight:20}]},{id:'unrelated',name:'Other',ex:[{id:known,sets:2,reps:10,weight:20}]}];S.routineOrder=['target','unrelated']
    const source={...empty(),routines:[{id:'first',name:'Shared name',ex:[{id:known,sets:3,reps:12,weight:40}]},{id:'second',name:'Shared name',ex:[{id:known,sets:4,reps:15,weight:50}]}],routineOrder:['first','second']}
    const data=createRoutineExchange(source),options={conflicts:{'routine:first':'replace','routine:second':'replace'}}
    const review=prepared(data,S,options)
    expect(review.canImport).toBe(false)
    expect(review.fullErrors.some(error=>/same existing routine/.test(error.message))).toBe(true)
    expect(review.preview.routines).toEqual([])
    expect(()=>applyRoutineExchange(S,validateRoutineExchange(data,S),{...options,acceptAdaptations:true})).toThrow(/same existing routine/)
    const safe=prepared(data,S,{conflicts:{'routine:first':'replace','routine:second':'copy'}})
    expect(safe.canImport).toBe(true)
    expect(safe.preview.routines.map(r=>r.id)).not.toContain('unrelated')
    expect(safe.preview.routines).toHaveLength(2)
  })

  it('converts preview and saved loads exactly once without changing global unit or timed increments',()=>{
    const data=raw(),S=empty('kg'),review=prepared(data,S)
    expect(review.choices.unit).toBe('convert')
    expect(review.summary.units).toEqual({source:'lb',destination:'kg',converted:true})
    expect(review.preview.unit).toBe('kg')
    expect(review.preview.routines[1].ex[0].weight).toBeCloseTo(100/2.2046226218)
    expect(review.preview.routines[0].ex[0].inc).toBe(5)
    const committed=commitRoutineImport(S,review)
    expect(committed.unit).toBe('kg')
    expect(committed.routines).toEqual(review.preview.routines)
    for(const [ri,routine] of committed.routines.entries())for(const [ei,ex] of routine.ex.entries())expect(planned(committed,ex)).toEqual(planned(review.draft,review.preview.routines[ri].ex[ei]))
    const again=prepared(data,committed)
    expect(again.effectiveCount).toBe(0)
  })

  it('shows applied schedule changes while retaining all unrelated assignments and reports overlapping slots',()=>{
    const data=raw(),S=empty();S.week={1:['unrelated'],2:['unrelated']};S.dayPlan={'2026-10-13':['unrelated']}
    const off=prepared(data,S,{selectedIds:['quota-routine-1']})
    expect(off.summary.schedule).toEqual({enabled:false,changes:[],conflicts:[]})
    expect(off.draft.week).toEqual(S.week)
    const on=prepared(data,S,{selectedIds:['quota-routine-1'],schedule:true})
    expect(on.draft.week[1]).toEqual(['unrelated','quota-routine-1'])
    expect(on.draft.week[2]).toEqual(['unrelated'])
    expect(on.draft.dayPlan).toEqual(S.dayPlan)
    expect(on.summary.schedule.conflicts).toEqual([expect.objectContaining({field:'week',key:'1',existingIds:['unrelated'],importedIds:['quota-routine-1']})])
    expect(commitRoutineImport(S,on).week).toEqual(on.draft.week)
  })

  it('uses matching enabled deload and explicit Back-off rules as notices without forced acknowledgement',()=>{
    const data=raw(),S=empty(),deload={on:true,notifications:true,normalWeeks:6,deloadWeeks:1,loadPct:80,setPct:60,targetRir:4,startDate:'2026-10-01'}
    data.rules.deload=deload;S.deload={...deload,notifications:false}
    const review=prepareRoutineImport(data,S)
    expect(review.adaptations).toEqual([])
    expect(review.notices.map(notice=>notice.key)).toContain('deload')
    expect(review.notices.map(notice=>notice.key)).toContain('backoff')
    expect(review.canImport).toBe(true)
    expect(review.draft.backoffRepsMode).toBe('increased')
    expect(review.preview.routines[1].ex[0].backoffRepsMode).toBe('same')
  })

  it('requires an explicit acknowledgement for genuinely different deload execution and invalidates pause changes',()=>{
    const data=raw(),S=empty();data.rules.deload={on:true,notifications:true,normalWeeks:6,deloadWeeks:1,loadPct:80,setPct:60,targetRir:4,startDate:'2026-10-01'}
    const pending=prepareRoutineImport(data,S)
    expect(pending.adaptations.map(item=>item.key)).toContain('deload')
    expect(pending.canImport).toBe(false)
    const accepted=prepared(data,S)
    expect(accepted.canImport).toBe(true)
    expect(()=>commitRoutineImport({...S,trainingPauses:[{id:'pause',start:'2026-10-02',end:'2026-10-09'}]},accepted)).toThrow(/plan changed/)
    expect(S.deload).toBeUndefined()
  })

  it('distinguishes pauses that change an enabled cycle from pauses entirely before its anchor',()=>{
    const data=raw(),S=empty(),deload={on:true,notifications:true,normalWeeks:6,deloadWeeks:1,loadPct:80,setPct:60,targetRir:4,startDate:'2026-10-01'}
    data.rules.deload=deload;S.deload=deload
    S.trainingPauses=[{id:'old',start:'2026-09-01',end:'2026-09-07'}]
    expect(prepareRoutineImport(data,S).adaptations.some(a=>a.key==='deload')).toBe(false)
    S.trainingPauses=[{id:'relevant',start:'2026-10-02',end:'2026-10-09'}]
    const changed=prepareRoutineImport(data,S)
    expect(changed.adaptations.some(a=>a.key==='deload')).toBe(true)
    expect(changed.canImport).toBe(false)
    expect(prepared(data,S).canImport).toBe(true)
  })

  it('does not hide malformed custom resources in a deselected routine',()=>{
    const data=raw();data.catalog.find(ex=>ex.id==='quota-custom-1').definition.img='blob:https://private.example/session'
    const review=prepared(data,empty(),{selectedIds:['quota-routine-3']})
    expect(review.fullErrors.some(error=>error.field==='img')).toBe(true)
    expect(review.canImport).toBe(false)
  })

  it('keeps version 1 uncertainty acknowledgement and explicit source unit requirements',()=>{
    const data={framegym_plan:1,routines:[{id:'legacy',name:'Legacy',ex:[{id:CATALOGUE[0].id,sets:2,reps:8,weight:100}]}],week:{1:'legacy'},customEx:[]},S=empty()
    expect(prepareRoutineImport(data,S).canImport).toBe(false)
    const pending=prepareRoutineImport(data,S,{legacyUnit:'lb'})
    expect(pending.adaptations.map(item=>item.key)).toContain('legacy-defaults')
    expect(pending.canImport).toBe(false)
    expect(prepared(data,S,{legacyUnit:'lb'}).canImport).toBe(true)
  })

  it('preserves live unrelated history and active set changes while rejecting changed import decisions',()=>{
    const data=raw(),S=empty(),review=prepared(data,S)
    const current=structuredClone(S);current.workouts[0].note='New history note';current.active.note='New active note'
    expect(commitRoutineImport(current,review).workouts).toEqual(current.workouts)
    expect(commitRoutineImport(current,review).active).toEqual(current.active)
    expect(()=>commitRoutineImport({...S,unit:'kg'},review)).toThrow(/plan changed/)
  })

  it('returns localized recovery text while retaining original validation messages as technical evidence',()=>{
    const calls=[],t=(key,...args)=>{calls.push([key,...args]);return 'Localized recovery'}
    const original={sheet:'Series',row:8,field:'sets',message:'Expected integer between 1 and 99'}
    expect(routineImportIssueText(original,t)).toBe('Localized recovery')
    expect(calls[0]).toEqual(['Use a whole number between {0} and {1}.','1','99'])
    expect(original.message).toBe('Expected integer between 1 and 99')
    expect(routineImportIssueText({message:'An unknown parser detail'},t)).toBe('Localized recovery')
  })
})
