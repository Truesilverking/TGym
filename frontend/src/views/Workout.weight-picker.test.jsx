// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {MemoryRouter} from 'react-router-dom'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import Workout from './Workout.jsx'
import Modals from '../components/Modals.jsx'
import {DEF,useStore} from '../store/useStore.js'
import {useUI} from '../store/useUI.js'
import {bindUI} from '../components/ui.jsx'
import {setLang} from '../lib/i18n.js'

vi.mock('../lib/sound.js',()=>({playAppSound:vi.fn(),vibrate:vi.fn()}))
vi.mock('../lib/api.js',()=>({api:vi.fn(async()=>({}))}))
vi.mock('../components/Media.jsx',()=>({default:()=>null}))

let host,root
const state=()=>useStore.getState().S
const rows=()=>state().active.entries[0].sets
const buttons=()=>[...host.querySelectorAll('button')]
const click=async button=>{expect(button).toBeTruthy();await act(()=>button.click())}
const action=text=>buttons().find(button=>button.textContent.trim()===text)
const trigger=(scope=host,index=0)=>scope.querySelectorAll('button[aria-label^="Weight ruler:"]')[index]
const picker=()=>host.querySelector('.bodyweight-picker input')
const type=async raw=>act(()=>{
 const field=picker();expect(field).not.toBeNull();field.focus()
 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,raw)
 field.dispatchEvent(new Event('input',{bubbles:true}));field.blur()
})
beforeEach(async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;vi.useFakeTimers();localStorage.clear();await setLang('en')
 useUI.setState({sheets:[],timer:null,work:null,appTourRequest:null,appTourWorkoutPreview:false});bindUI(useUI)
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
})
afterEach(async()=>{
 await act(()=>root.unmount());host.remove();useUI.getState().closeAll();useUI.getState().stopRest();useUI.getState().stopWork()
 vi.clearAllTimers();vi.useRealTimers();vi.restoreAllMocks()
})
async function mount({unit='kg',target={},sets=[{w:42.75,r:8,rir:2,done:false}]}={}){
 const S={...structuredClone(DEF),unit,lang:'en',effort:'rir',hasCompletedOnboarding:true,hasCompletedAppTour:true,
  workouts:[{id:'history-kept',start:100,end:200,entries:[]}],routines:[{id:'routine-kept',name:'Routine',ex:[]}],
  active:{id:'weight-session',d:'2026-10-25',start:Date.now(),unit,cur:0,name:'Synthetic session',entries:[{id:'0025',asked:true,target:{mode:'reps',bodyweight:false,...target},sets}]}}
 useStore.setState({S,user:null})
 await act(()=>root.render(<MemoryRouter><Workout/><Modals/></MemoryRouter>))
}
async function choose(button,raw){await click(button);await type(raw);await click(action('Done'))}

it('opens and cancels a precise load without writing the workout, history or profile unit',async()=>{
 await mount();const before=structuredClone(state())
 await click(trigger());expect(Number(picker().value)).toBe(43)
 await type('350.125');expect(state()).toEqual(before);expect(localStorage.getItem('gym_state_v1')).toBeNull()
 await click(action('Cancel'))
 expect(useUI.getState().sheets).toHaveLength(0);expect(state()).toEqual(before)
 expect(localStorage.getItem('gym_state_v1')).toBeNull()
})

it('keeps an isolated draft open when a rest timer or unrelated preference clones the unchanged row',async()=>{
 await mount()
 await act(()=>useStore.getState().update(s=>{s.active.restTimer={endsAt:Date.now()+60000,total:60}}))
 const before=structuredClone(rows()[0]),history=structuredClone(state().workouts)
 await click(trigger());await type('43.125')
 await act(()=>useStore.getState().update(s=>{delete s.active.restTimer;s.keepAwake=false}))
 expect(rows()[0]).toEqual(before);expect(picker()).not.toBeNull();expect(picker().value).toBe('43')
 await click(action('Done'))
 expect(rows()[0].w).toBe(43.125);expect(state().active.restTimer).toBeUndefined();expect(state().keepAwake).toBe(false)
 expect(state().workouts).toEqual(history)
})

it.each(['remove','reorder'])('discards a draft when %s changes its series context despite an equal load',async change=>{
 await mount({sets:[{w:42.75,r:8,done:false},{w:42.75,r:10,done:false}]})
 await click(trigger());await type('50')
 await act(()=>useStore.getState().update(s=>{
  const sets=s.active.entries[0].sets
  if(change==='remove')sets.shift();else sets.reverse()
 }))
 expect(picker()).toBeNull();expect(useUI.getState().sheets).toHaveLength(0)
 expect(rows().every(row=>row.w===42.75)).toBe(true);expect(rows()[0].r).toBe(10)
})

it.each([['kg',110.25,100],['lb',165.375,150]])('applies a %s ruler load through existing Top/Back-off cascades and retains it on reload',async(unit,weight,backoff)=>{
 await mount({unit,target:{setScheme:'topback',reps:6,topRepsMin:4,topRepsMax:6,backoffPct:10},sets:[
  {w:25,r:5,warmup:true,done:true},{w:100,r:6,role:'top',done:false},
  {w:95,r:8,role:'backoff',manualFields:{w:true},done:false},{w:90,r:8,role:'backoff',done:false}]})
 const before=structuredClone(state())
 await choose(trigger(),String(weight))
 expect(rows().map(row=>row.w)).toEqual([25,weight,95,backoff])
 expect(rows()[1].manualFields.w).toBe(true);expect(rows()[2].manualFields.w).toBe(true)
 expect(state().unit).toBe(unit);expect(state().workouts).toEqual(before.workouts);expect(state().routines).toEqual(before.routines)
 const saved=JSON.parse(localStorage.getItem('gym_state_v1'))
 expect(saved.active.entries[0].sets[1].w).toBe(weight)
 await act(()=>{root.unmount();root=createRoot(host);useStore.getState().replaceState(saved);root.render(<MemoryRouter><Workout/><Modals/></MemoryRouter>)})
 expect(rows().map(row=>row.w)).toEqual([25,weight,95,backoff])
 expect(host.querySelector(`input[aria-label="Weight (${unit})"]`).value).toBe(String(Math.round(weight)))
})

it('edits drop loads independently and keeps Rest-pause bursts on their shared base load',async()=>{
 await mount({sets:[{w:40,r:10,done:false,type:'dropset',drops:[{w:30,r:8},{w:20,r:6}]},
  {w:40,r:15,done:false,type:'restpause',clusters:[{r:10,restSec:15},{r:5,restSec:15}]}]})
 const bursts=structuredClone(rows()[1].clusters),history=structuredClone(state().workouts)
 await choose(trigger(host.querySelectorAll('.subrow')[1]),'17.125')
 expect(rows()[0]).toMatchObject({w:40,r:10,drops:[{w:30,r:8},{w:17.125,r:6}]})
 const workRows=host.querySelectorAll('.set-console:not(.done)')
 await choose(trigger(workRows[1]),'0')
 expect(rows()[1]).toMatchObject({w:0,r:15,manualFields:{w:true},clusters:bursts})
 expect(state().workouts).toEqual(history)
 expect(JSON.parse(localStorage.getItem('gym_state_v1')).active.entries[0].sets[0].drops[1].w).toBe(17.125)
})

it('covers pending warm-up and time-hold loads without turning duration or effort into weight selectors',async()=>{
 await mount({target:{mode:'time',sec:45},sets:[{w:10,sec:20,warmup:true,done:false},{w:20,sec:45,done:false}]})
 expect(host.querySelectorAll('button[aria-label^="Weight ruler:"]')).toHaveLength(2)
 await choose(trigger(),'12.75')
 expect(rows()[0]).toMatchObject({w:12.75,sec:20,warmup:true})
 expect(rows()[1]).toMatchObject({w:20,sec:45})
 expect(host.querySelectorAll('input[aria-label="Seconds"]')).toHaveLength(2)
})

it('offers the same zero-capable load selector after explicitly enabling bodyweight additions',async()=>{
 await mount({target:{bodyweight:true,reps:8},sets:[{w:0,r:8,done:false}]})
 expect(trigger()).toBeUndefined();await click(action('Log added weight'))
 const added=host.querySelector('button[aria-label="Weight ruler: Added (kg)"]')
 await choose(added,'0')
 expect(rows()[0].w).toBe(0);expect(state().active.entries[0].logAddedWeight).toBe(true)
 expect(state().unit).toBe('kg');expect(state().workouts).toHaveLength(1)
})
