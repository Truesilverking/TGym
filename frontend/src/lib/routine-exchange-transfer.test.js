import {describe,expect,it} from 'vitest'
import {CATALOGUE} from './exercises.js'
import {applyRoutineExchange as apply,routineExchangeReviewKey,validateRoutineExchange,createRoutineExchange} from './routine-exchange.js'
import {dailyPlan} from './daily-plan.js'

const known=CATALOGUE.find(ex=>CATALOGUE.filter(other=>other.n===ex.n).length===1)
const blank=()=>({unit:'kg',routines:[],routineOrder:[],customEx:[],exerciseAliases:{},exNotes:{},week:{},dayPlan:{},daySkipped:{},workouts:[],active:null,exWeights:{}})
const cfg=id=>({id,sets:2,reps:8,weight:20})
const custom=(id,n='Remo original á')=>({id,n,bp:'back',eq:'cable',custom:true})
function envelope(ex=custom('local-custom')){
  return {tgym_routine_exchange:1,unit:'kg',routines:[{id:'incoming',name:'Origen',ex:[cfg(ex.id),cfg(ex.id)]}],routineOrder:['incoming'],week:{1:['incoming']},dayPlan:{'2026-10-11':['incoming']},catalog:[{...ex,definition:{...ex},alias:'Apodo origen',aliasPresent:true,libraryNote:'Nota portátil ñ'}],rules:{}}
}
const choices=(checked,value='copy')=>Object.fromEntries(checked.conflicts.map(conflict=>[conflict.key,conflict.kind==='unit'?'convert':value]))
const applyRoutineExchange=(S,checked,options={})=>apply(S,checked,{acceptAdaptations:true,...options})

describe('cross-device identity and semantic-duplicate regressions',()=>{
  it('copies a collided custom identity without replacing or reusing the unrelated destination movement',()=>{
    const S=blank(),old=custom('local-custom','Press destino'),data=envelope()
    S.customEx=[old];S.routines=[{id:'existing',name:'Destino',ex:[cfg(old.id)]}];S.routineOrder=['existing']
    S.exerciseAliases[old.id]='Alias destino';S.exNotes[old.id]='Nota destino';S.exWeights[old.id]=40
    S.workouts=[{id:'history',routineId:'existing',entries:[{id:old.id,sets:[{done:true,reps:8,weight:40}]}]}]
    S.active={id:'pending',routineId:'existing',entries:[{id:old.id,sets:[{done:false,reps:8,weight:40}]}]}
    const before=structuredClone(S),sourceBefore=structuredClone(data),check=validateRoutineExchange(data,S)
    expect(check.conflicts).toEqual(expect.arrayContaining([expect.objectContaining({key:'catalog:local-custom',allowedChoices:['copy'],canMap:true})]))
    expect(()=>applyRoutineExchange(S,check)).toThrow()
    expect(()=>applyRoutineExchange(S,check,{conflicts:choices(check,'replace')})).toThrow()
    const next=applyRoutineExchange(S,check,{conflicts:choices(check),schedule:true}),imported=next.routines.find(r=>r.id==='incoming'),id=imported.ex[0].id
    expect(id).not.toBe(old.id);expect(imported.ex.map(e=>e.id)).toEqual([id,id])
    expect(next.customEx.find(ex=>ex.id===old.id)).toEqual(old)
    expect(next.customEx.find(ex=>ex.id===id)).toEqual({...custom('local-custom'),id})
    expect(next.exerciseAliases).toEqual({...before.exerciseAliases,[id]:'Apodo origen'})
    expect(next.exNotes).toEqual({...before.exNotes,[id]:'Nota portátil ñ'})
    expect(next.routines[0]).toEqual(before.routines[0]);expect(next.workouts).toEqual(before.workouts);expect(next.active).toEqual(before.active);expect(next.exWeights).toEqual(before.exWeights)
    expect(S).toEqual(before);expect(data).toEqual(sourceBefore)
  })

  it('reuses a uniquely matching complete custom definition after a prior cross-device remap',()=>{
    const S=blank(),data=envelope(custom('remote-id'))
    S.customEx=[custom('local-remap')]
    const checked=validateRoutineExchange(data,S)
    expect(checked.valid).toBe(true);expect(checked.data.routines[0].ex.every(e=>e.id==='local-remap')).toBe(true)
    const next=applyRoutineExchange(S,checked)
    expect(next.customEx).toEqual(S.customEx);expect(next.exerciseAliases['local-remap']).toBe('Apodo origen')
  })

  it('requires explicit correspondence when several destination definitions are equally exact',()=>{
    const S=blank(),data=envelope(custom('remote-id'))
    S.customEx=[custom('candidate-a'),custom('candidate-b')]
    const pending=validateRoutineExchange(data,S)
    expect(pending.valid).toBe(false);expect(pending.unresolved).toEqual(expect.arrayContaining([expect.objectContaining({id:'remote-id'})]))
    const checked=validateRoutineExchange(data,S,{exerciseMappings:{'remote-id':'candidate-b'}}),next=applyRoutineExchange(S,checked)
    expect(next.routines[0].ex.every(e=>e.id==='candidate-b')).toBe(true);expect(next.customEx).toEqual(S.customEx)
    expect(next.exerciseAliases).toEqual(S.exerciseAliases);expect(next.exNotes).toEqual(S.exNotes)
  })

  it('resolves an exact unique built-in original independently of a foreign ID colliding with a custom',()=>{
    const S=blank(),data=envelope({id:'foreign-local',n:known.n,custom:false})
    S.customEx=[custom('foreign-local','Unrelated destination custom')]
    delete data.catalog[0].definition
    const checked=validateRoutineExchange(data,S)
    expect(checked.valid).toBe(true);expect(checked.data.routines[0].ex.every(e=>e.id===known.id)).toBe(true)
    const next=applyRoutineExchange(S,checked)
    expect(next.customEx).toEqual(S.customEx)
  })

  it('never selects an exercise by matching only its alias or a colliding unidentified source ID',()=>{
    const S=blank(),data=envelope({id:'foreign-local',n:'Apodo compartido',custom:false})
    S.customEx=[custom('foreign-local','Original destino')];S.exerciseAliases['foreign-local']='Apodo compartido'
    delete data.catalog[0].definition
    const checked=validateRoutineExchange(data,S)
    expect(checked.valid).toBe(false);expect(checked.unresolved.map(ex=>ex.id)).toEqual(['foreign-local'])
    expect(()=>applyRoutineExchange(S,checked)).toThrow()
  })

  it('reserves routine IDs referenced only by history so a new routine cannot appear completed',()=>{
    const S=blank(),data=envelope({id:known.id,n:known.n,custom:false})
    delete data.catalog[0].definition
    S.workouts=[{id:'old',routineId:'incoming',d:'2026-10-11',name:'Deleted routine',entries:[{id:known.id,sets:[{done:true,reps:8,weight:20}]}]}]
    const before=structuredClone(S),check=validateRoutineExchange(data,S)
    expect(check.conflicts).toEqual(expect.arrayContaining([expect.objectContaining({key:'routine:incoming',reserved:true,allowedChoices:['keep','copy']})]))
    expect(()=>applyRoutineExchange(S,check)).toThrow()
    const next=applyRoutineExchange(S,check,{conflicts:choices(check),schedule:true})
    expect(next.routines[0].id).not.toBe('incoming');expect(next.dayPlan['2026-10-11']).toEqual([next.routines[0].id])
    expect(dailyPlan(next,'2026-10-11').items[0].status).toBe('pending');expect(next.workouts).toEqual(before.workouts)
    expect(applyRoutineExchange(S,check,{conflicts:choices(check,'keep')})).toEqual(before)
  })

  it('detects equivalent routine content after exercise remapping even when routine ID and name differ',()=>{
    const S=blank(),data=envelope(custom('remote-id'))
    S.customEx=[custom('local-remap')];S.routines=[{id:'local-routine',name:'Different presentation',ex:[cfg('local-remap'),cfg('local-remap')]}];S.routineOrder=['local-routine']
    const checked=validateRoutineExchange(data,S,{exerciseMappings:{'remote-id':'local-remap'}})
    expect(checked.conflicts).toEqual(expect.arrayContaining([expect.objectContaining({key:'routine:incoming',semanticIds:['local-routine']})]))
    expect(()=>applyRoutineExchange(S,checked)).toThrow()
    expect(applyRoutineExchange(S,checked,{conflicts:choices(checked,'keep')})).toEqual(S)
    const next=applyRoutineExchange(S,checked,{conflicts:choices(checked)})
    expect(next.routines).toHaveLength(2);expect(next.routines[1].id).not.toBe('local-routine')
  })

  it('invalidates reviewed identities when history/active/schedule reservations change but ignores clocks and set status',()=>{
    const S=blank();S.active={id:'live',routineId:'existing',entries:[{id:known.id,sets:[{done:false}]}]}
    const key=routineExchangeReviewKey(S)
    S.active.clock={elapsed:20};S.active.entries[0].sets[0].done=true;S._ts=100
    expect(routineExchangeReviewKey(S)).toBe(key)
    S.workouts.push({id:'historic',routineId:'newly-reserved',entries:[{id:'new-exercise-id',sets:[]}]})
    expect(routineExchangeReviewKey(S)).not.toBe(key)
  })

  it('reserves resume, substituted and saved-exercise references without inspecting performed values',()=>{
    const S=blank(),data=envelope(custom('resume-ex'))
    S.avoidedExercises=['avoided-id']
    S.workouts=[{id:'old',entries:[{id:known.id,substitutedFor:'resume-ex',exercise:custom('saved-id')}],resumeSnapshot:{routineId:'incoming',entries:[{id:'nested-id',target:{id:'target-id'}}]}}]
    const checked=validateRoutineExchange(data,S)
    expect(checked.conflicts).toEqual(expect.arrayContaining([expect.objectContaining({key:'catalog:resume-ex'}),expect.objectContaining({key:'routine:incoming',reserved:true})]))
    const key=routineExchangeReviewKey(S)
    S.workouts[0].resumeSnapshot.entries[0].target.id='new-reserved-target'
    expect(routineExchangeReviewKey(S)).not.toBe(key)
    const avoided=envelope(custom('avoided-id'))
    expect(validateRoutineExchange(avoided,S).conflicts.some(c=>c.key==='catalog:avoided-id')).toBe(true)
  })

  it('requires acknowledgement for legacy defaults and preserves source prescriptions without overwriting destination preferences',()=>{
    const S={...blank(),backoffRepsMode:'increased',strictReps:false,restSec:180},data=envelope({id:known.id,n:known.n,custom:false})
    delete data.catalog[0].definition
    data.rules={backoffRepsMode:'same',strictReps:true,restSec:45,effort:'rir'}
    data.routines[0].ex=[{...cfg(known.id),setScheme:'topback',topSets:1,backoffSets:2,topRepsMin:4,topRepsMax:6,repRange:true,autoBackoffReps:true}]
    const checked=validateRoutineExchange(data,S)
    expect(checked.adaptations).toEqual(expect.arrayContaining([expect.objectContaining({key:'legacy-defaults'}),expect.objectContaining({key:'effort'})]))
    expect(()=>apply(S,checked)).toThrow(/explicitly accept/)
    const next=apply(S,checked,{acceptAdaptations:true,rules:true})
    expect(next.routines[0].ex[0]).toMatchObject({backoffRepsMode:'same',backoffRepsOverride:true,strictReps:true,restSec:45})
    expect(next.backoffRepsMode).toBe(S.backoffRepsMode);expect(next.strictReps).toBe(S.strictReps);expect(next.restSec).toBe(S.restSec);expect(next.effort).toBeUndefined()
    expect(S.routines).toEqual([])
  })

  it('previews converted source loading steps once and keeps timed increments in seconds',()=>{
    const source={...blank(),unit:'lb',routines:[{id:'timed',name:'Timed',ex:[{id:known.id,mode:'time',sets:2,sec:45,weight:100,inc:5,loadingStep:5}]}],routineOrder:['timed']},S=blank(),data=createRoutineExchange(source)
    const pending=validateRoutineExchange(data,S)
    expect(pending.data.unit).toBe('lb');expect(pending.sourceUnit).toBe('lb')
    const checked=validateRoutineExchange(data,S,{conflicts:{unit:'convert'}})
    expect(checked.data.unit).toBe('kg');expect(checked.sourceData.unit).toBe('lb')
    expect(checked.data.routines[0].ex[0].loadingStep).toBeCloseTo(2.267962)
    const next=applyRoutineExchange(S,checked,{conflicts:{unit:'convert'}})
    expect(next.routines[0].ex[0].weight).toBeCloseTo(45.359237);expect(next.routines[0].ex[0].loadingStep).toBeCloseTo(2.267962);expect(next.routines[0].ex[0].inc).toBe(5)
  })

  it('reimporting a copied custom reuses its identity and reviews the semantic duplicate',()=>{
    const S=blank(),data=envelope();S.customEx=[custom('local-custom','Unrelated movement')]
    const firstCheck=validateRoutineExchange(data,S),first=applyRoutineExchange(S,firstCheck,{conflicts:choices(firstCheck)})
    const checked=validateRoutineExchange(data,first)
    expect(checked.conflicts.some(c=>c.kind==='catalog')).toBe(false)
    expect(checked.conflicts).toEqual(expect.arrayContaining([expect.objectContaining({key:'routine:incoming',semanticIds:['incoming']})]))
    expect(checked.data.routines[0].ex[0].id).toBe(first.routines[0].ex[0].id)
    const again=applyRoutineExchange(first,checked,{conflicts:choices(checked,'replace')})
    expect(again).toEqual(first)
  })

  it('blocks incomplete version 2 source context and unsupported configuration with recoverable field errors',()=>{
    const source={...blank(),routines:[{id:'r',name:'Portable',ex:[cfg(known.id)]}],routineOrder:['r']},S=blank(),data=createRoutineExchange(source)
    delete data.rules.restAdvanced.supersetRound
    const missing=validateRoutineExchange(data,S)
    expect(missing.valid).toBe(false);expect(missing.errors).toEqual(expect.arrayContaining([expect.objectContaining({field:'restAdvanced.supersetRound'})]))
    const unsupported=envelope({id:known.id,n:known.n,custom:false});delete unsupported.catalog[0].definition
    unsupported.routines[0].ex[0].unsupportedRule={source:'not understood'}
    const checked=validateRoutineExchange(unsupported,S)
    expect(checked.valid).toBe(false);expect(checked.errors.some(e=>e.message.includes('unsupportedRule'))).toBe(true)
    expect(()=>applyRoutineExchange(S,checked)).toThrow();expect(S.routines).toEqual([])
  })

  it('does not let unrelated unsupported local fields crash incoming validation or mutate that plan',()=>{
    const S=blank(),source={...blank(),routines:[{id:'r',name:'Portable',ex:[cfg(known.id)]}],routineOrder:['r']}
    S.routines=[{id:'old',name:'Local plan',legacyUnknownRule:1,ex:[cfg(known.id)]}];S.routineOrder=['old']
    const checked=validateRoutineExchange(createRoutineExchange(source),S)
    expect(checked.valid).toBe(true)
    const next=applyRoutineExchange(S,checked)
    expect(next.routines[0]).toEqual(S.routines[0])
  })

  it('validates used GIF/media definitions but does not reject unused legacy full-catalog resources',()=>{
    const S=blank(),data=envelope();data.catalog[0].definition.gif='blob:device-A-only'
    expect(validateRoutineExchange(data,S).errors.some(e=>e.field==='gif')).toBe(true)
    const unused=envelope({id:known.id,n:known.n,custom:false});delete unused.catalog[0].definition
    unused.catalog.push({...custom('unused'),definition:{...custom('unused'),gif:'blob:device-A-only'}})
    expect(validateRoutineExchange(unused,S).valid).toBe(true)
    const next=applyRoutineExchange(S,validateRoutineExchange(unused,S))
    expect(next.customEx).toEqual([])
  })

  it('uses the source custom cardio definition when an older prescription omitted explicit mode',()=>{
    const S=blank(),data=envelope({...custom('cardio-custom','Bicicleta propia'),bp:'cardio'})
    data.routines[0].ex=[{id:'cardio-custom',sets:1,min:15,speed:6}]
    const checked=validateRoutineExchange(data,S)
    expect(checked.errors).toEqual([])
    const next=applyRoutineExchange(S,checked)
    expect(next.routines[0].ex[0]).toMatchObject({mode:'cardio',min:15,speed:6})
    expect(next.routines[0].ex[0].reps).toBeUndefined()
  })

  it('returns recoverable size/serialization errors before any draft mutation',()=>{
    const S=blank(),oversized=envelope();oversized.routines[0].note='x'.repeat(15*1024*1024)
    expect(validateRoutineExchange(oversized,S).errors.some(e=>e.field==='Archivo')).toBe(true)
    const cyclic=envelope();cyclic.self=cyclic
    expect(()=>validateRoutineExchange(cyclic,S)).not.toThrow()
    expect(validateRoutineExchange(cyclic,S).valid).toBe(false);expect(S.routines).toEqual([])
  })

  it('does not request a disabled deload adaptation for notification or inactive calendar differences',()=>{
    const source={...blank(),deload:{on:false,notifications:true,normalWeeks:5,startDate:'2026-10-01'},routines:[{id:'r',name:'Portable',ex:[cfg(known.id)]}],routineOrder:['r']},S={...blank(),deload:{on:false,notifications:false,normalWeeks:6,startDate:null}}
    const data=createRoutineExchange(source)
    expect(validateRoutineExchange(data,S).adaptations.some(a=>a.key==='deload')).toBe(false)
    const enabled={...source,deload:{...source.deload,on:true}}
    const checked=validateRoutineExchange(createRoutineExchange(enabled),{...S,deload:{...enabled.deload}})
    expect(checked.adaptations.some(a=>a.key==='deload')).toBe(false)
    expect(checked.notices.some(a=>a.key==='deload')).toBe(true)
    expect(()=>apply({...S,deload:{...enabled.deload}},checked)).not.toThrow()
  })
})
