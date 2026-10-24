import { afterEach, expect, it, vi } from 'vitest'
import { loadWebState, saveWebState, loadPreUpdateBackup, savePreUpdateBackup } from './web-state.js'
import { createBackup, readBackup } from './backup.js'

afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals()})
function disk({stallOpen=false,stallRead=false,stallWrite=false,failWrite=false,failOpen=false}={}) {
 const values=new Map(),db={close:vi.fn(),transaction:()=>{
  const tx={abort:vi.fn(),objectStore:()=>({
   put:(value,key)=>{if(!stallWrite)queueMicrotask(()=>{if(failWrite){tx.error=Error('Disk full');tx.onerror()}else{values.set(key,value);tx.oncomplete()}})},
   get:key=>{const r={result:values.get(key)};if(!stallRead)queueMicrotask(()=>r.onsuccess());return r}
  })};return tx
 }}
 vi.stubGlobal('indexedDB',{open:()=>{const request={result:db,error:Error('Storage denied')};if(!stallOpen)queueMicrotask(()=>failOpen?request.onerror():request.onsuccess());return request}})
 return {db,values}
}
it('serializes durable snapshots without retaining mutable caller references',async()=>{
 const {values}=disk();const state={workouts:[{id:'first'}]};const saving=saveWebState(state);state.workouts[0].id='mutated'
 await expect(saving).resolves.toBe(true);expect(values.get('current').workouts[0].id).toBe('first')
 expect(await loadWebState()).toEqual({workouts:[{id:'first'}]})
})
it.each(['stallOpen','stallWrite'])('bounds %s and allows the next write to recover',async kind=>{
 vi.useFakeTimers();disk({[kind]:true});const failed=expect(saveWebState({id:'old'})).rejects.toThrow('busy')
 await vi.advanceTimersByTimeAsync(5000);await failed
 disk();await expect(saveWebState({id:'new'})).resolves.toBe(true)
})
it('does not hold startup forever when an IndexedDB read transaction stalls',async()=>{
 vi.useFakeTimers();const {db}=disk({stallRead:true});const loading=loadWebState()
 await vi.advanceTimersByTimeAsync(5000);expect(await loading).toBeNull();expect(db.close).toHaveBeenCalled()
})
it('coalesces rapid mirror updates to the latest complete profile',async()=>{
 const {db,values}=disk()
 const writes=Array.from({length:100},(_,i)=>saveWebState({revision:i}))
 await Promise.all(writes)
 expect(values.get('current')).toEqual({revision:99});expect(db.close).toHaveBeenCalledOnce()
})
it('keeps a portable pre-update backup separate from current and later profile writes',async()=>{
 const {values}=disk(),state={routines:[{id:'r'}],workouts:[{id:'history',entries:[]}],theme:'dark'}
 await saveWebState(state)
 const backup=JSON.stringify(createBackup(state))
 await expect(savePreUpdateBackup(backup)).resolves.toBe(true)
 expect(values.get('current')).toEqual(state)
 expect(readBackup(JSON.parse(await loadPreUpdateBackup()))).toEqual(state)
 await saveWebState({...state,theme:'light'})
 expect(await loadWebState()).toEqual({...state,theme:'light'})
 expect(await loadPreUpdateBackup()).toBe(backup)
})
it.each(['unsupported','denied','write failure'])('uses the existing localStorage backup when IndexedDB is %s',async reason=>{
 const values=new Map()
 vi.stubGlobal('localStorage',{setItem:(key,value)=>values.set(key,value),getItem:key=>values.get(key)})
 if(reason==='unsupported')vi.stubGlobal('indexedDB',undefined)
 else disk(reason==='denied'?{failOpen:true}:{failWrite:true})
 const backup=JSON.stringify(createBackup({routines:[],workouts:[]}))
 await expect(savePreUpdateBackup(backup)).resolves.toBe(true)
 expect(values.get('tgym_pre_update_backup')).toBe(backup)
 expect(await loadPreUpdateBackup()).toBe(backup)
})
it('retains both prior copies when neither backup store can commit',async()=>{
 const {values}=disk({failWrite:true}),current={routines:[],workouts:[{id:'kept'}]},previous=JSON.stringify(createBackup(current))
 values.set('current',current);values.set('pre-update',previous)
 vi.stubGlobal('localStorage',{setItem:()=>{throw new DOMException('Full','QuotaExceededError')},getItem:()=>previous})
 await expect(savePreUpdateBackup('new backup')).rejects.toMatchObject({code:'pre_update_backup_failed'})
 expect(values.get('current')).toEqual(current);expect(values.get('pre-update')).toBe(previous)
 expect(await loadPreUpdateBackup()).toBe(previous)
})
it('reads a newer committed fallback instead of a stale IndexedDB backup',async()=>{
 const {values}=disk({failWrite:true}),legacy=new Map()
 const state={routines:[],workouts:[]},older=JSON.stringify(createBackup(state,new Date('2026-10-10T12:00:00Z'))),newer=JSON.stringify(createBackup({...state,theme:'light'},new Date('2026-10-11T12:00:00Z')))
 values.set('pre-update',older)
 vi.stubGlobal('localStorage',{setItem:(key,value)=>legacy.set(key,value),getItem:key=>legacy.get(key)})
 await savePreUpdateBackup(newer)
 expect(values.get('pre-update')).toBe(older)
 expect(await loadPreUpdateBackup()).toBe(newer)
 values.set('pre-update',JSON.stringify(createBackup({...state,theme:'dark'},new Date('2026-10-12T12:00:00Z'))))
 expect(readBackup(JSON.parse(await loadPreUpdateBackup())).theme).toBe('dark')
})
it.each(['stallOpen','stallWrite'])('bounds pre-update %s before falling back and permits retry',async kind=>{
 vi.useFakeTimers();const legacy=new Map()
 const first=JSON.stringify(createBackup({routines:[],workouts:[]})),retry=JSON.stringify(createBackup({routines:[],workouts:[],theme:'light'}))
 vi.stubGlobal('localStorage',{setItem:(key,value)=>legacy.set(key,value),getItem:key=>legacy.get(key)})
 disk({[kind]:true})
 const saving=savePreUpdateBackup(first)
 await vi.advanceTimersByTimeAsync(5000);await expect(saving).resolves.toBe(true)
 expect(legacy.get('tgym_pre_update_backup')).toBe(first)
 const {values}=disk();await savePreUpdateBackup(retry)
 expect(values.get('pre-update')).toBe(retry);expect(await loadPreUpdateBackup()).toBe(retry)
})
it('bounds a stalled backup read and reads the legacy copy without touching current',async()=>{
 vi.useFakeTimers();const {values,db}=disk({stallRead:true})
 const backup=JSON.stringify(createBackup({routines:[],workouts:[]}))
 values.set('current',{id:'current'})
 vi.stubGlobal('localStorage',{getItem:key=>key==='tgym_pre_update_backup'?backup:null})
 const reading=loadPreUpdateBackup()
 await vi.advanceTimersByTimeAsync(5000);expect(await reading).toBe(backup)
 expect(db.close).toHaveBeenCalled();expect(values.get('current')).toEqual({id:'current'})
})
it('closes an IndexedDB connection that opens after the backup wait expires',async()=>{
 vi.useFakeTimers();let request;const db={close:vi.fn()}
 vi.stubGlobal('indexedDB',{open:()=>request={result:db}})
 vi.stubGlobal('localStorage',{setItem:vi.fn()})
 const saving=savePreUpdateBackup('backup')
 await vi.advanceTimersByTimeAsync(5000);await saving
 request.onsuccess();expect(db.close).toHaveBeenCalledOnce()
})
it.each(['indexedDB','localStorage'])('ignores a newer corrupt %s copy in favor of the other valid backup',async brokenStore=>{
 const {values}=disk(),valid=JSON.stringify(createBackup({routines:[],workouts:[{id:'preserved'}]},new Date('2026-10-10T12:00:00Z')))
 const corrupt=createBackup({routines:[],workouts:[]},new Date('2026-10-11T12:00:00Z'));corrupt.data.workouts.push({id:'tampered'})
 values.set('pre-update',brokenStore==='indexedDB'?JSON.stringify(corrupt):valid)
 vi.stubGlobal('localStorage',{getItem:()=>brokenStore==='localStorage'?JSON.stringify(corrupt):valid})
 expect(await loadPreUpdateBackup()).toBe(valid)
})
it('returns no recovery backup when both copies fail schema or integrity validation',async()=>{
 const {values}=disk(),future=createBackup({routines:[],workouts:[]});future.schemaVersion=99
 values.set('pre-update',JSON.stringify(future));vi.stubGlobal('localStorage',{getItem:()=>'{truncated'})
 expect(await loadPreUpdateBackup()).toBeNull()
})
