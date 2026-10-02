// @vitest-environment happy-dom
import {beforeEach,it,expect,vi} from 'vitest'
import {useStore,DEF} from './useStore.js'
const disk=vi.hoisted(()=>({value:null,save:vi.fn(),fail:false}))
vi.mock('../lib/demo.js',()=>({STANDALONE:true,DEMO:false,DEMO_SEEDED:'test'}))
vi.mock('../lib/web-state.js',()=>({loadWebState:async()=>disk.value,saveWebState:async s=>{if(disk.fail)throw Error("quota");disk.value=structuredClone(s);disk.save(s);return true}}))
beforeEach(()=>{localStorage.clear();disk.value=null;disk.fail=false;disk.save.mockClear();useStore.setState({S:structuredClone(DEF),user:null,ready:false,needsMobileOnboarding:false})})
it('new PWA runs onboarding once and durably saves the completion before closing',async()=>{await useStore.getState().boot();expect(useStore.getState().needsMobileOnboarding).toBe(true);await useStore.getState().completeOnboarding();expect(disk.value.hasCompletedOnboarding).toBe(true);localStorage.clear();useStore.setState({S:structuredClone(DEF),ready:false});await useStore.getState().boot();expect(useStore.getState().needsMobileOnboarding).toBe(false)})
it('recovers older training data and tour flags after a PWA update/storage loss',async()=>{disk.value={...structuredClone(DEF),_ts:123,hasCompletedAppTour:true,routines:[{id:'r',name:'run',ex:[]}],workouts:[{id:'w',routineId:'r',activity:{type:'running'},entries:[]}],inbody:[{id:'i',image:'saved-reference'}]};await useStore.getState().boot();expect(useStore.getState().S.hasCompletedAppTour).toBe(true);expect(useStore.getState().needsMobileOnboarding).toBe(false);expect(JSON.parse(localStorage.getItem('gym_state_v1')).inbody[0].image).toBe('saved-reference');expect(useStore.getState().S.workouts[0].routineId).toBe('r')})
it('does not restore a stale mirror over newer local work',async()=>{disk.value={...structuredClone(DEF),_ts:1};useStore.setState({S:{...structuredClone(DEF),_ts:2,workouts:[{id:'new'}]}});await useStore.getState().boot();expect(useStore.getState().S.workouts[0].id).toBe('new')})

it('restores sound choices, custom PCM, gain and mute after offline reopen/update',async()=>{
 disk.value={...structuredClone(DEF),_ts:123,sound:false,soundMuted:true,soundVolume:.4,sounds:{rest:'custom_saved',set:'silent'},customSounds:[{id:'custom_saved',data:'preserved'}]}
 await useStore.getState().boot()
 expect(useStore.getState().S).toMatchObject({sound:false,soundMuted:true,soundVolume:.4,sounds:{rest:'custom_saved',set:'silent'},customSounds:[{id:'custom_saved',data:'preserved'}]})
 expect(JSON.parse(localStorage.getItem('gym_state_v1')).soundVolume).toBe(.4)
})

it('recovers active manual values and edit protection from the offline PWA mirror',async()=>{
 const active={id:'live',cur:0,start:Date.now(),entries:[{id:'ex',logAddedWeight:true,note:'Keep',target:{reps:10},sets:[{w:42.5,r:8,rir:0,done:true,doneAt:Date.now(),manualFields:{w:true,r:true}},{w:50,r:12,done:false}]}]};
 disk.value={...structuredClone(DEF),_ts:Date.now(),active};await useStore.getState().boot();
 expect(useStore.getState().S.active.entries).toEqual(active.entries);expect(JSON.parse(localStorage.getItem('gym_state_v1')).active.entries).toEqual(active.entries)
})

it('keeps the primary save and reports a failed mirror until retry succeeds',async()=>{
 disk.fail=true
 useStore.getState().update(s=>{s.routines=[{id:'offline',name:'Saved',ex:[]}]})
 await useStore.getState().flushPersistence()
 expect(useStore.getState().storageWarning).toBe('mirror')
 expect(JSON.parse(localStorage.getItem('gym_state_v1')).routines[0].id).toBe('offline')
 disk.fail=false;await useStore.getState().flushPersistence()
 expect(useStore.getState().storageWarning).toBeNull();expect(disk.value.routines[0].id).toBe('offline')
})

it('persists Back-off preference and pending targets through offline reopen/update recovery',async()=>{
 const history=[{id:'saved',entries:[{sets:[{role:'backoff',r:8,done:true}]}]}]
 useStore.setState({S:{...structuredClone(DEF),workouts:history,active:{id:'live',start:Date.now(),entries:[{id:'ex',target:{setScheme:'topback',reps:6,topRepsMin:4,topRepsMax:6},sets:[{role:'top',r:6},{role:'backoff',r:8},{role:'backoff',r:9,manualFields:{r:true}}]}]}}})
 useStore.getState().update(s=>{s.backoffRepsMode='same'})
 await useStore.getState().flushPersistence()
 expect(JSON.parse(localStorage.getItem('gym_state_v1')).backoffRepsMode).toBe('same')
 localStorage.clear();useStore.setState({S:structuredClone(DEF),ready:false});await useStore.getState().boot()
 expect(useStore.getState().S.backoffRepsMode).toBe('same')
 expect(useStore.getState().S.active.entries[0].sets.map(s=>s.r)).toEqual([6,6,9])
 expect(useStore.getState().S.workouts).toEqual(history)
})
