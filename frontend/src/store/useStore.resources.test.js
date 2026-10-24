// @vitest-environment happy-dom
import {webcrypto} from 'node:crypto'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {useStore,DEF} from './useStore.js'
import {EXIDX,registerCustom} from '../lib/exercises.js'
import {applyRoutineExchange,createRoutineExchange,validateRoutineExchange} from '../lib/routine-exchange.js'
import {anonymousQuotaExchange,anonymousQuotaSource} from '../lib/routine-import-quota.fixture.js'
import {compactProfile,exportProfileRecovery,hydrateProfile,retainProfileResources} from '../lib/profile-resources.js'
import {migrateState,STATE_SCHEMA} from '../lib/state-migrations.js'

vi.mock('../lib/demo.js',()=>({STANDALONE:true,DEMO:false,DEMO_SEEDED:'test'}))
const KEY='gym_state_v1'
const syntheticMedia=anonymousQuotaSource().customEx.filter(ex=>ex.img).map(ex=>ex.img)
let sequence=0,quota,writing,disk,failKey
function profileDisk() {
  const stores={snapshots:new Map(),resources:new Map()},controls={failPut:0,denied:false,hold:false,wrongRead:false,puts:[],release:[]}
  const db={close:vi.fn(),transaction:(name,mode)=>{
    const staged=new Map(stores[name]);let failed=false,count=0
    const tx={error:null,abort:()=>{failed=true;tx.error ||= new DOMException('Aborted','AbortError');queueMicrotask(()=>tx.onabort?.())},objectStore:()=>({
      put:(value,key)=>{count++;controls.puts.push({name,key,bytes:typeof value==='string'?value.length:JSON.stringify(value).length});const request={error:null};
        queueMicrotask(()=>{if(failed)return;if(name==='resources'&&controls.failPut===count){failed=true;request.error=tx.error=new DOMException('Resource disk full','QuotaExceededError');request.onerror?.();tx.onerror?.()}else staged.set(key,structuredClone(value))});return request},
      get:key=>{const request={result:null,error:null};queueMicrotask(()=>{request.result=controls.wrongRead&&name==='resources'?'altered resource':stores[name].get(key);request.onsuccess?.()});return request}
    })}
    const complete=()=>{queueMicrotask(()=>queueMicrotask(()=>{if(!failed){if(mode==='readwrite')stores[name]=staged;tx.oncomplete?.()}}))}
    if(controls.hold&&name==='resources'&&mode==='readwrite')controls.release.push(complete);else complete()
    return tx
  }}
  vi.stubGlobal('indexedDB',{open:()=>{const request={result:db,error:new DOMException('Access denied','SecurityError')};queueMicrotask(()=>controls.denied?request.onerror?.():request.onsuccess?.());return request}})
  return {stores:()=>stores,controls,db}
}
const prior=()=>({...structuredClone(DEF),_ts:1,unit:'lb',lang:'es',theme:'light',backoffRepsMode:'increased',customEx:[{id:'existing-custom',n:'Existing exercise'}],routines:[{id:'existing-routine',name:'Existing',ex:[]}],week:{0:['existing-routine']},workouts:[{id:'protected-history',routineId:'existing-routine',entries:[]}],active:{id:'protected-active',routineId:'existing-routine',start:Date.now(),lastUserInteractionAt:Date.now(),entries:[{id:'existing-custom',sets:[{r:8,done:false}]}]}})
function source() {sequence++;return {...structuredClone(DEF),unit:'lb',customEx:[{id:`new-${sequence}`,n:'Generated resource exercise',custom:true,bp:'back',eq:'cable',img:syntheticMedia[4],gif:syntheticMedia[4]}],routines:[{id:`import-${sequence}`,name:'Imported',ex:[{id:`new-${sequence}`,mode:'reps',sets:3,reps:8,repsMin:6,repRange:true,weight:100,topSets:1,backoffSets:2,setScheme:'topback',backoffPct:15,autoBackoffReps:true,backoffRepsMode:'same',backoffRepsOverride:true}]}],week:{1:[`import-${sequence}`]}}}
function review(exchange=createRoutineExchange(source())) {const checked=validateRoutineExchange(exchange,useStore.getState().S);expect(checked.valid).toBe(true);const conflicts=Object.fromEntries(checked.conflicts.map(c=>[c.key,c.kind==='unit'?'convert':c.allowedChoices.includes('replace')?'replace':'copy']));return S=>Object.assign(S,applyRoutineExchange(S,checked,{conflicts,schedule:true,acceptAdaptations:true}))}
beforeEach(()=>{
  vi.stubGlobal('crypto',webcrypto);disk=profileDisk();quota=120000;writing=[];failKey=null;retainProfileResources({});localStorage.clear()
  useStore.setState({S:prior(),user:null,ready:false,storageError:null,storageDiagnostics:null,storageWarning:null})
  useStore.getState().replaceState(prior(),false)
  const original=localStorage.setItem.bind(localStorage)
  vi.spyOn(localStorage,'setItem').mockImplementation((key,value)=>{writing.push({key,bytes:value.length*2});if(key===failKey)throw new DOMException('Denied','SecurityError');if(key===KEY&&value.length*2>quota)throw new DOMException('The quota has been exceeded.','QuotaExceededError');original(key,value)})
})
afterEach(async()=>{await useStore.getState().flushPersistence();vi.restoreAllMocks();vi.unstubAllGlobals();registerCustom([]);retainProfileResources({})})

it('reproduces the original-sized anonymous quota case and commits verified media references without dropping prescriptions',async()=>{
  quota=5*1024*1024
  const before=useStore.getState().S,mut=review(anonymousQuotaExchange())
  // The original synchronous path fails at the same primary operation.
  expect(()=>useStore.getState().update(mut,true,false)).toThrow('The quota has been exceeded.')
  expect(useStore.getState().S).toBe(before)
  await useStore.getState().updateAtomic(mut,true,false)
  const after=useStore.getState().S,core=JSON.parse(localStorage.getItem(KEY))
  expect(writing.some(write=>write.key===KEY&&write.bytes>9_000_000)).toBe(true)
  expect(localStorage.getItem(KEY).length*2).toBeLessThan(200_000)
  expect(core).toMatchObject({_webStorage:{version:1},storageVersion:STATE_SCHEMA})
  expect(core.customEx.some(ex=>typeof ex.img==='object')).toBe(true)
  expect(after.routines).toHaveLength(7);expect(after.customEx).toHaveLength(8)
  for(const key of ['unit','lang','theme','backoffRepsMode','workouts'])expect(after[key]).toEqual(before[key])
  expect(after.active.entries).toEqual(before.active.entries);expect(after.active.id).toBe(before.active.id)
  const hydrated=await hydrateProfile(core)
  expect(hydrated).toEqual(after)
  const importedIds=after.routines.filter(r=>r.id!=='existing-routine').map(r=>r.id)
  const exported=createRoutineExchange(hydrated,importedIds)
  const empty={...structuredClone(DEF),unit:'lb'},validation=validateRoutineExchange(exported,empty)
  expect(validation.valid).toBe(true)
  const returned=applyRoutineExchange(empty,validation,{acceptAdaptations:true,schedule:true})
  expect(returned.routines).toEqual(after.routines.filter(r=>r.id!=='existing-routine'))
  expect(returned.customEx).toEqual(after.customEx.filter(ex=>ex.id!=='existing-custom'))
  useStore.getState().update(S=>{S.theme='dark'})
  expect(localStorage.getItem(KEY).length*2).toBeLessThan(200_000)
  expect((await hydrateProfile(JSON.parse(localStorage.getItem(KEY)))).theme).toBe('dark')
// This case hashes and round-trips the original-sized anonymous payload while
// the complete suite runs in parallel. Quota and content assertions stay exact.
},15000)
it.each(['empty','existing'])('saves into an %s profile, deduplicates immutable resources, and reopens offline',async kind=>{
  if(kind==='empty'){useStore.setState({S:{...structuredClone(DEF),unit:'lb'}});localStorage.setItem(KEY,JSON.stringify(useStore.getState().S))}
  await useStore.getState().updateAtomic(review(),true,false)
  const saved=useStore.getState().S,raw=JSON.parse(localStorage.getItem(KEY))
  expect(disk.stores().resources.size).toBe(1)
  expect(saved.customEx.at(-1).img).toBe(saved.customEx.at(-1).gif)
  retainProfileResources({});useStore.setState({S:raw,ready:false})
  await useStore.getState().boot()
  expect(useStore.getState().S).toEqual(saved);expect(useStore.getState().ready).toBe(true)
  const current=disk.stores().snapshots.get('current')
  expect(current.customEx.at(-1).img).toEqual(raw.customEx.at(-1).img)
})
it('aborts a failing intermediate resource transaction and retains every prior primary field and registry entry',async()=>{
  const original=source();original.customEx[0].gif=syntheticMedia[5];const mut=review(createRoutineExchange(original)),before=useStore.getState().S,raw=localStorage.getItem(KEY)
  disk.controls.failPut=2
  await expect(useStore.getState().updateAtomic(mut,true,false)).rejects.toMatchObject({diagnostics:{stage:'resource-write',backend:'indexedDB',store:'resources',operation:'put'},cause:{name:'QuotaExceededError'}})
  expect(useStore.getState().S).toBe(before);expect(localStorage.getItem(KEY)).toBe(raw);expect(disk.stores().resources.size).toBe(0);expect(EXIDX[original.customEx[0].id]).toBeUndefined()
  disk.controls.failPut=0;await useStore.getState().updateAtomic(mut,true,false)
  expect(useStore.getState().S.routines).toHaveLength(2);expect(disk.stores().resources.size).toBe(2)
})
it('retains the origin if verified resources commit but even the compact core cannot fit; retry adds no duplicates',async()=>{
  const mut=review(),before=useStore.getState().S,raw=localStorage.getItem(KEY);quota=1
  await expect(useStore.getState().updateAtomic(mut,true,false)).rejects.toMatchObject({diagnostics:{stage:'profile-write',key:KEY,resourceCount:1},cause:{name:'QuotaExceededError'}})
  expect(useStore.getState().S).toBe(before);expect(localStorage.getItem(KEY)).toBe(raw);expect(disk.stores().resources.size).toBe(1)
  quota=120000;await useStore.getState().updateAtomic(mut,true,false)
  expect(useStore.getState().S.routines).toHaveLength(2);expect(useStore.getState().S.customEx).toHaveLength(2);expect(disk.stores().resources.size).toBe(1)
})
it.each(['permission','corrupt-read'])('keeps the source until %s verification succeeds',async kind=>{
  const mut=review(),before=useStore.getState().S,raw=localStorage.getItem(KEY)
  disk.controls.denied=kind==='permission';disk.controls.wrongRead=kind==='corrupt-read'
  await expect(useStore.getState().updateAtomic(mut,true,false)).rejects.toMatchObject({diagnostics:{backend:'indexedDB'}})
  expect(useStore.getState().S).toBe(before);expect(localStorage.getItem(KEY)).toBe(raw)
})
it('prevents overlapping atomic confirmations and cannot overwrite edits made while resources are staged',async()=>{
  const mut=review(),before=useStore.getState().S;disk.controls.hold=true
  const pending=useStore.getState().updateAtomic(mut,true,false)
  await vi.waitFor(()=>expect(disk.controls.release).toHaveLength(1))
  await expect(useStore.getState().updateAtomic(mut,true,false)).rejects.toMatchObject({code:'profile_save_busy'})
  expect(useStore.getState().S).toBe(before)
  useStore.getState().update(S=>{S.theme='dark'})
  disk.controls.release[0]()
  await expect(pending).rejects.toMatchObject({code:'profile_changed_during_save'})
  expect(useStore.getState().S.routines).toHaveLength(1);expect(useStore.getState().S.theme).toBe('dark')
})
it('blocks missing resources at reopen without overwriting the core and recovers from temporary permission denial',async()=>{
  await useStore.getState().updateAtomic(review(),true,false)
  const saved=useStore.getState().S,raw=localStorage.getItem(KEY),core=JSON.parse(raw)
  retainProfileResources({});useStore.setState({S:core,ready:false});disk.controls.denied=true
  await useStore.getState().boot()
  expect(useStore.getState().storageError).toBeTruthy();expect(useStore.getState().S).toBe(core);expect(localStorage.getItem(KEY)).toBe(raw)
  const deniedRecovery=await exportProfileRecovery(raw)
  expect(deniedRecovery.rawProfile).toBe(raw);expect(deniedRecovery.unavailable).toHaveLength(1)
  disk.controls.denied=false;await useStore.getState().retryStorage()
  expect(useStore.getState().storageError).toBeNull();expect(useStore.getState().S).toEqual(saved)
  const availableRecovery=await exportProfileRecovery(raw)
  expect(availableRecovery.resources).toHaveLength(1);expect(availableRecovery.unavailable).toEqual([])
  disk.stores().resources.clear();retainProfileResources({});useStore.setState({S:core,ready:false});await useStore.getState().boot()
  expect(useStore.getState().storageError).toMatch(/missing or damaged/);expect(localStorage.getItem(KEY)).toBe(raw)
})
it('keeps storage representation metadata out of hydrated portable state and rejects unknown representation/schema versions',async()=>{
  expect(()=>migrateState({storageVersion:STATE_SCHEMA+1})).toThrow('newer version')
  await expect(hydrateProfile({...structuredClone(DEF),_webStorage:{version:99}})).rejects.toMatchObject({diagnostics:{stage:'resource-version'}})
  await useStore.getState().updateAtomic(review(),true,false)
  expect(createRoutineExchange(useStore.getState().S)).not.toHaveProperty('_webStorage')
  expect(compactProfile(useStore.getState().S)).toHaveProperty('_webStorage.version',1)
})
it('reimports the same reviewed exchange without duplicating definitions, routines, or immutable resources',async()=>{
  const exchange=createRoutineExchange(source())
  await useStore.getState().updateAtomic(review(exchange),true,false)
  const saved=useStore.getState().S,puts=disk.controls.puts.filter(put=>put.name==='resources').length
  await useStore.getState().updateAtomic(review(exchange),true,false)
  expect(useStore.getState().S.routines).toEqual(saved.routines);expect(useStore.getState().S.customEx).toEqual(saved.customEx)
  expect(disk.controls.puts.filter(put=>put.name==='resources')).toHaveLength(puts)
})
it.each(['dirty','primary'])('identifies the exact %s write and restores previous sync intent before exposing a failure',async failed=>{
  const before=useStore.getState().S,raw=localStorage.getItem(KEY)
  useStore.setState({user:{id:'qa'}});localStorage.setItem('gym_dirty','previous')
  failKey=failed==='dirty'?'gym_dirty':KEY
  await expect(useStore.getState().updateAtomic(S=>{S.theme='dark'})).rejects.toMatchObject({diagnostics:{key:failed==='dirty'?'gym_dirty':KEY,operation:'setItem'},cause:{name:'SecurityError'}})
  expect(useStore.getState().S).toBe(before);expect(localStorage.getItem(KEY)).toBe(raw);expect(localStorage.getItem('gym_dirty')).toBe('previous')
})
