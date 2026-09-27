import { afterEach, expect, it, vi } from 'vitest'
import { loadWebState, saveWebState } from './web-state.js'

afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals()})
function disk({stallOpen=false,stallRead=false,stallWrite=false}={}) {
 const values=new Map(),db={close:vi.fn(),transaction:()=>{
  const tx={abort:vi.fn(),objectStore:()=>({
   put:(value,key)=>{values.set(key,value);if(!stallWrite)queueMicrotask(()=>tx.oncomplete())},
   get:key=>{const r={result:values.get(key)};if(!stallRead)queueMicrotask(()=>r.onsuccess());return r}
  })};return tx
 }}
 vi.stubGlobal('indexedDB',{open:()=>{const request={result:db};if(!stallOpen)queueMicrotask(()=>request.onsuccess());return request}})
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
