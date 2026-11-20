import { describe, expect, it } from 'vitest'
import { CATALOGUE } from './exercises.js'
import { createRoutineExchange } from './routine-exchange.js'
import { materializeRoutinePrescription, customTransferIssues } from './routine-portability.js'
import { repBounds, strictRepsFor, withBackoffRepsMode, applyTrainingPlan } from './training-plan.js'
import { buildSets } from './history.js'
import { restSeconds } from './rest-policy.js'

const heavy = CATALOGUE.find(ex => ex.bp === 'back').id
const gif = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
const source = () => ({unit:'kg', strictReps:true, backoffRepsMode:'same', restSec:45, restAdvanced:{warmup:20,supersetMove:10,supersetRound:150}, routines:[{id:'r',name:'Fuerza ñ',note:'Ángulo',ex:[{id:heavy,sets:3,reps:8,repsMin:6,weight:103,inc:2.5,warmupSets:2,setScheme:'topback',topSets:1,backoffSets:2,topRepsMin:6,topRepsMax:8,backoffPct:15,note:'Text =1+1'}]}],routineOrder:['r'],week:{1:['r']},dayPlan:{'2026-10-11':['r']},customEx:[],workouts:[],exWeights:{}})
const target = () => ({...source(),unit:'kg',strictReps:false,backoffRepsMode:'increased',restSec:180,restAdvanced:{warmup:120,supersetMove:0,supersetRound:60},routines:[],routineOrder:[],workouts:[{id:'unrelated-history',entries:[]}],exWeights:{}})
const signature = (S,routine,cfg) => ({
 backoff:repBounds(withBackoffRepsMode(cfg,S),'backoff'), strict:strictRepsFor(S,cfg),
 rest:['set','supersetMove','supersetRound'].map(phase=>restSeconds({state:S,routine,target:cfg,phase})),warmupRest:restSeconds({state:S,routine,target:cfg,warmup:true}),
 sets:applyTrainingPlan(buildSets(S,cfg,{step:cfg.loadingStep||5}),withBackoffRepsMode(cfg,S),cfg.loadingStep||5),
})

describe('portable routine prescription snapshots',()=>{
 it('retains effective ranges, loading rules and rests while destination settings stay distinct',()=>{
  const S=source(),before=structuredClone(S),data=createRoutineExchange(S),D=target(),r=data.routines[0]
  expect(data.tgym_routine_exchange).toBe(2)
  expect(signature(D,r,r.ex[0])).toEqual(signature(S,S.routines[0],S.routines[0].ex[0]))
  expect(r.ex[0]).toMatchObject({weight:103,inc:2.5,loadingStep:5,strictReps:true,backoffRepsMode:'same',backoffRepsOverride:true,restSec:45,warmupRestSec:20,supersetMoveRestSec:10,supersetRoundRestSec:150})
  expect(r.ex[0].backoffRepsMin).toBe(6);expect(r.ex[0].backoffRepsMax).toBe(8)
  expect(D.backoffRepsMode).toBe('increased');expect(D.restSec).toBe(180);expect(S).toEqual(before)
  expect(materializeRoutinePrescription(D,r)).toEqual(r)
 })
 it('does not copy personal/history-derived loads or completed data into the plan',()=>{
  const S=source();S.exWeights[heavy]={w:200};S.workouts=[{id:'personal',entries:[{id:heavy,sets:[{w:200,r:20,done:true}]}]}]
  S.routines[0].accessToken='SYNTHETIC_PRIVATE';S.routines[0].ex[0].password='SYNTHETIC_PRIVATE'
  const data=createRoutineExchange(S),text=JSON.stringify(data)
  expect(data.routines[0].ex[0].weight).toBe(103)
  expect(data).not.toHaveProperty('workouts');expect(data).not.toHaveProperty('exWeights');expect(text).not.toContain('SYNTHETIC_PRIVATE')
 })
 it('captures legacy effort preference and effective missing rule defaults without including personal settings',()=>{
  const S=source();S.effort=null;S.showRir=true;S.cloudSync={accessToken:'SYNTHETIC_PRIVATE'}
  let data=createRoutineExchange(S)
  expect(data.rules).toMatchObject({effort:'rir',strictReps:true,backoffRepsMode:'same',restSec:45,restAdvanced:{warmup:20,supersetMove:10,supersetRound:150},deload:{on:false}})
  S.effort='none';data=createRoutineExchange(S);expect(data.rules.effort).toBe('none')
  expect(data.rules).not.toHaveProperty('showRir');expect(data.rules).not.toHaveProperty('cloudSync')
 })
 it('uses source profile defaults for partial templates and rejects an enabled undated deload',()=>{
  const S={routines:[{id:'r',name:'Partial',ex:[{id:heavy,sets:1,reps:8}]}]}
  const data=createRoutineExchange(S)
  expect(data.rules).toMatchObject({backoffRepsMode:'increased',strictReps:false,effort:'none',restSec:90,restAdvanced:{warmup:45,supersetMove:0,supersetRound:120},deload:{on:false,startDate:null}})
  expect(data.routines[0].ex[0]).toMatchObject({restSec:90,warmupRestSec:45,supersetMoveRestSec:0,supersetRoundRestSec:120})
  S.deload={on:true};expect(()=>createRoutineExchange(S)).toThrow(/startDate.*cannot be guessed/)
 })
 it('respects explicit and independent Back-off exceptions, including legacy per-side +4',()=>{
  const S=source(),base=S.routines[0].ex[0]
  S.routines[0].ex=[{...base,backoffRepsOverride:true,backoffRepOffset:4,side:true,repsPerSide:false},{...base,autoBackoffReps:false,backoffRepsMin:13,backoffRepsMax:15}]
  const r=materializeRoutinePrescription(S,S.routines[0])
  expect(repBounds(r.ex[0],'backoff')).toEqual({min:10,max:12});expect(r.ex[0].backoffRepsOverride).toBe(true)
  expect(r.ex[1]).toMatchObject({autoBackoffReps:false,backoffRepsMin:13,backoffRepsMax:15});expect(r.ex[1]).not.toHaveProperty('backoffRepsOverride')
 })
 it('resolves custom cardio, bodyweight and load increments from the source definition independently of EXIDX',()=>{
  const S=source();S.unit='lb';S.customEx=[{id:'unregistered-heavy',n:'Custom heavy',bp:'back',eq:'body weight'},{id:'unregistered-cardio',n:'Custom cardio',bp:'cardio',eq:'custom'}]
  S.routines[0].ex=[{id:'unregistered-heavy',sets:2,reps:8,weight:0},{id:'unregistered-cardio',sets:1,min:20,speed:8}]
  const r=materializeRoutinePrescription(S,S.routines[0])
  expect(r.ex[0]).toMatchObject({mode:'reps',bodyweight:true,inc:10,loadingStep:10,prog:'linear'})
  expect(r.ex[1]).toMatchObject({mode:'cardio',bodyweight:false,prog:'off'})
  S.routines[0].ex[0]={id:'unregistered-heavy',mode:'time',sets:1,sec:45,weight:10}
  expect(materializeRoutinePrescription(S,S.routines[0]).ex[0]).toMatchObject({mode:'time',inc:5,loadingStep:10,prog:'off'})
 })
 it('preserves zero rests, repeated instances, notes, guide slots and intensifiers',()=>{
  const S=source(),base=S.routines[0].ex[0];S.routines[0].guideSlots=[{id:'slot',source:'guide',label:'Tracción',hint:'Sin balanceo',sets:3,reps:8}]
  S.routines[0].ex=[{...base,restSec:0,warmupRestSec:0,sg:'ss',intensifier:{type:'dropset',count:2,pct:20}},{...base,weight:10,sg:'ss',intensifier:{type:'restpause',totalReps:20,restSec:15}}]
  const r=createRoutineExchange(S).routines[0]
  expect(r.guideSlots).toEqual(S.routines[0].guideSlots);expect(r.ex).toHaveLength(2)
  expect(r.ex[0]).toMatchObject({restSec:0,warmupRestSec:0,sg:'ss',note:'Text =1+1',intensifier:{type:'dropset',count:2,pct:20}})
  expect(r.ex[1].weight).toBe(10);expect(r.ex[1].intensifier.totalReps).toBe(20)
 })
 it('retains legacy technical fields and blocks unknown public fields instead of silently discarding them',()=>{
  const S=source();Object.assign(S.routines[0].ex[0],{tempo:'3-0-1',warmup:0,n:'Legacy label'})
  expect(createRoutineExchange(S).routines[0].ex[0]).toMatchObject({tempo:'3-0-1',warmup:0,n:'Legacy label'})
  S.routines[0].ex[0].futurePrescription='unsupported'
  expect(()=>createRoutineExchange(S)).toThrow(/futurePrescription.*full backup.*silently omitted/)
  delete S.routines[0].ex[0].futurePrescription;S.routines[0].futureRule={value:1}
  expect(()=>createRoutineExchange(S)).toThrow(/futureRule/)
 })
 it('retains planned activity classification and supported legacy custom muscle metadata',()=>{
  const S=source(),definition={id:'activity',n:'Caminar',bp:'cardio',eq:'body weight',activityType:'walking',primaryMuscles:['legs'],secondaryMuscles:['abs'],targetMuscles:['quadriceps'],muscleWeights:{quadriceps:1},mg:'legs',cues:['Caminar erguido']}
  S.customEx=[definition];S.routines[0].ex=[{id:'activity',mode:'time',activityType:'walking',sec:900,min:15,speed:0,sets:1,rest:0,prog:'off'}]
  const data=createRoutineExchange(S)
  expect(data.routines[0].ex[0]).toMatchObject({activityType:'walking',rest:0,mode:'time',sec:900})
  expect(data.catalog.find(ex=>ex.id==='activity').definition).toEqual(definition)
 })
})

describe('portable custom resources and selected catalogue metadata',()=>{
 it('embeds a referenced GIF once and excludes unselected custom data and credentials',()=>{
  const S=source();S.customEx=[{id:'c-used',n:'Mismo nombre',bp:'back',eq:'custom',img:gif,desc:'Descripción',st:['Paso'],accessToken:'SYNTHETIC_PRIVATE'},{id:'c-unused',n:'Mismo nombre',img:'blob:https://source.invalid/unavailable',password:'SYNTHETIC_PRIVATE'}]
  S.exerciseAliases={'c-used':'Apodo igual','c-unused':'Apodo igual'};S.exNotes={'c-used':'Nota seleccionada','c-unused':'Nota no seleccionada'}
  S.routines[0].ex=[{id:'c-used',sets:1,reps:8,weight:10}]
  const data=createRoutineExchange(S),text=JSON.stringify(data),custom=data.catalog.filter(ex=>ex.custom)
  expect(custom).toHaveLength(1);expect(custom[0]).toMatchObject({id:'c-used',n:'Mismo nombre',alias:'Apodo igual',libraryNote:'Nota seleccionada',definition:{img:gif,desc:'Descripción',st:['Paso']}})
  expect(custom[0]).not.toHaveProperty('img');expect(text.split(gif)).toHaveLength(2)
  expect(text).not.toContain('Nota no seleccionada');expect(text).not.toContain('SYNTHETIC_PRIVATE');expect(text).not.toContain('blob:')
 })
 it('retains the complete exercise list for a template only when explicitly requested',()=>{
  const S=source();S.customEx=[{id:'c',n:'Personalizado',img:gif}];S.exerciseAliases={[heavy]:'Private unrelated alias'};S.exNotes={[heavy]:'Private unrelated note'}
  const normal=createRoutineExchange(S,[]),template=createRoutineExchange(S,[],{fullCatalog:true})
  expect(normal.catalog).toHaveLength(CATALOGUE.length);expect(JSON.stringify(normal)).not.toContain('Private unrelated')
  expect(template.catalog).toHaveLength(CATALOGUE.length+1);expect(template.catalog.find(ex=>ex.id==='c').definition.img).toBe(gif)
  expect(template.routines).toEqual([])
 })
 it.each(['blob:https://source.example/temp','file:///device/exercise.gif','content://media/image/2','img/local.gif','C:\\private\\exercise.gif','https://localhost/img.gif','https://127.0.0.1/img.gif','https://user:secret@example.com/img.gif','https://example.com/img.gif?token=secret','data:image/gif;base64,R0lGODlh','data:image/png;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'])('rejects nonportable or malformed resource %s',img=>{
  expect(customTransferIssues({id:'c',n:'Custom',img},{version:2})).toEqual(expect.arrayContaining([expect.objectContaining({field:'img'})]))
 })
 it('accepts an embedded valid GIF or a public HTTPS URL and flags private fields even in legacy definitions',()=>{
  expect(customTransferIssues({id:'c',n:'Custom',img:gif,st:['First step']})).toEqual([])
  expect(customTransferIssues({id:'c',n:'Custom',img:'https://example.com/public/exercise.gif'})).toEqual([])
  expect(customTransferIssues({id:'c',n:'Custom',accessToken:'SYNTHETIC'},{version:1})).toEqual([expect.objectContaining({field:'accessToken'})])
  expect(customTransferIssues({id:'c',n:'Custom',futureField:1},{version:1})).toEqual([])
  expect(customTransferIssues({id:'c',n:'Custom',futureField:1},{version:2})).toEqual([expect.objectContaining({field:'futureField'})])
  expect(customTransferIssues({id:'c',n:'Custom',muscleWeights:{secret:'SYNTHETIC'}},{version:2})).toEqual([expect.objectContaining({field:'muscleWeights.secret'})])
 })
 it('checks embedded container integrity rather than accepting a signature with corrupt or missing image data',()=>{
  const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGOUqzBiYGBgYgADAAl2AMwP1ktHAAAAAElFTkSuQmCC'
  expect(customTransferIssues({id:'c',n:'Custom',img:png})).toEqual([])
  // Header/terminator alone must not turn a damaged resource into a portable image.
  const fakeGif='data:image/gif;base64,'+btoa('GIF89a'+String.fromCharCode(1,0,1,0,0,0,0,0x3b))
  const corruptPng=atob(png.split(',')[1]).split('');corruptPng[45]=String.fromCharCode(corruptPng[45].charCodeAt(0)^1)
  expect(customTransferIssues({id:'c',n:'Custom',img:fakeGif})).toEqual([expect.objectContaining({field:'img'})])
  expect(customTransferIssues({id:'c',n:'Custom',img:'data:image/png;base64,'+btoa(corruptPng.join(''))})).toEqual([expect.objectContaining({field:'img'})])
  expect(customTransferIssues({id:'c',n:'Custom',img:'data:image/jpeg;base64,/9j/2Q=='})).toEqual([expect.objectContaining({field:'img'})])
  const fakeJpeg=btoa(String.fromCharCode(255,216,255,192,0,2,255,218,0,2,255,217))
  expect(customTransferIssues({id:'c',n:'Custom',img:'data:image/jpeg;base64,'+fakeJpeg})).toEqual([expect.objectContaining({field:'img'})])
 })
 it('blocks export instead of dropping a used resource that cannot travel',()=>{
  const S=source();S.customEx=[{id:'c',n:'Custom',img:'blob:https://source.example/temp'}];S.routines[0].ex=[{id:'c',sets:1,reps:8,weight:10}]
  expect(()=>createRoutineExchange(S)).toThrow(/Custom.*img.*Blob, file and device-local/)
 })
 it('does not export a custom exercise under an existing built-in identity',()=>{
  const S=source();S.customEx=[{id:heavy,n:'Different custom',img:gif}]
  expect(()=>createRoutineExchange(S)).toThrow(/collides with a built-in/)
 })
})
