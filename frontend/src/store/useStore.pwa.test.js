// @vitest-environment happy-dom
import {beforeEach,it,expect,vi} from 'vitest'
import {useStore,DEF} from './useStore.js'
const disk=vi.hoisted(()=>({value:null,save:vi.fn()}))
vi.mock('../lib/demo.js',()=>({STANDALONE:true,DEMO:false,DEMO_SEEDED:'test'}))
vi.mock('../lib/web-state.js',()=>({loadWebState:async()=>disk.value,saveWebState:async s=>{disk.value=structuredClone(s);disk.save(s);return true}}))
beforeEach(()=>{localStorage.clear();disk.value=null;disk.save.mockClear();useStore.setState({S:structuredClone(DEF),user:null,ready:false,needsMobileOnboarding:false})})
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
