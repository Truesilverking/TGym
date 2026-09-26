// @vitest-environment happy-dom
import React, {act} from 'react'
import {createRoot} from 'react-dom/client'
import {MemoryRouter} from 'react-router-dom'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import Workout from './Workout.jsx'
import {DEF,useStore} from '../store/useStore.js'
import {useUI} from '../store/useUI.js'
import {bindUI} from '../components/ui.jsx'
import {doFinishWorkout} from '../sheets.jsx'
import {workoutVolume} from '../lib/history.js'
import {convertWeightState} from '../lib/unit-conversion.js'
vi.mock('../lib/sound.js',()=>({playAppSound:vi.fn(),vibrate:vi.fn()}))
vi.mock('../lib/api.js',()=>({api:vi.fn(async()=>({}))}))
vi.mock('../components/Media.jsx',()=>({default:()=>null}))
globalThis.IS_REACT_ACT_ENVIRONMENT=true
let root,container
const state=()=>useStore.getState().S
const rows=()=>state().active.entries[0].sets
const input=(name,i=0)=>container.querySelectorAll(`input[aria-label="${name}"]`)[i]
const type=(field,value)=>act(()=>{field.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,value);field.dispatchEvent(new Event('input',{bubbles:true}))})
const click=label=>act(()=>container.querySelector(`[aria-label="${label}"]`).click())
beforeEach(()=>{vi.useFakeTimers();localStorage.clear();useUI.setState({sheets:[],timer:null,work:null});bindUI(useUI);container=document.createElement('div');document.body.appendChild(container);root=createRoot(container)})
afterEach(()=>{act(()=>root.unmount());container.remove();useUI.getState().stopRest();useUI.getState().stopWork();vi.clearAllTimers();vi.useRealTimers()})
function mount(target={},sets=[{w:40,r:10,done:false},{w:40,r:10,done:false}],plan=null){
 const S=structuredClone(DEF);Object.assign(S,{lang:'en',strictReps:true,effort:'rir'});
 S.active={id:'input',d:'2026-09-25',name:'Session',start:Date.now(),unit:'kg',cur:0,entries:[{id:'0025',asked:true,target:{mode:'reps',bodyweight:false,...target},sets,plan}]};
 useStore.setState({S,user:null});act(()=>root.render(<MemoryRouter><Workout/></MemoryRouter>))
}
it.each([{},{reps:'AMRAP'},{reps:5,amrap:true}])('records actual reps independently of prescription %j',target=>{
 mount(target);type(input('Actual reps'),'1');type(input('Actual reps'),'15');expect(rows()[0].r).toBe(15);expect(state().active.entries[0].target).toMatchObject(target)
 expect(JSON.parse(localStorage.getItem('gym_state_v1')).active.entries[0].sets[0].r).toBe(15)
})
it('labels Greyskull final work as AMRAP and allows results beyond target',()=>{mount({reps:5},undefined,{policy:'greyskull'});expect(container.textContent).toContain('AMRAP');type(input('Actual reps',1),'18');expect(rows()[1].r).toBe(18)})
it('retains decimal load, edited pending rows, completed rows and refresh state',()=>{
 mount({reps:10,repsMin:8,repRange:true});type(input('Weight (kg)',1),'52,5');type(input('Weight (kg)'),'42.75');expect(rows().map(s=>s.w)).toEqual([42.75,52.5]);
 act(()=>container.querySelector('[role="checkbox"]').click());expect(container.querySelector('.set-summary input')).toBeNull();expect(container.querySelector('.set-summary').textContent).toContain('42.75');act(()=>container.querySelector('.set-undo').click());type(input('Weight (kg)'),'43,25');type(input('Actual reps'),'8');act(()=>container.querySelector('[role="checkbox"]').click());expect(rows()[0]).toMatchObject({done:true,w:43.25,r:8});
 const saved=JSON.parse(localStorage.getItem('gym_state_v1'));act(()=>{root.unmount();root=createRoot(container);useStore.getState().replaceState(saved);root.render(<MemoryRouter><Workout/></MemoryRouter>)});
 expect(container.querySelector('.set-summary').textContent).toContain('43.25');expect(container.querySelector('.set-summary input')).toBeNull();expect(rows()[0].r).toBe(8);expect(rows()[1].manualFields.w).toBe(true)
 act(()=>doFinishWorkout());expect(state().active).toBe(null);expect(workoutVolume(state().workouts[0])).toBe(346);expect(state().workouts[0].entries[0].target.reps).toBe(10)
})
it('converts the actual and prescribed loads together while retaining manual protection',()=>{
 mount({reps:10,weight:40});type(input('Weight (kg)'),'42,5');act(()=>useStore.getState().update(s=>convertWeightState(s,'lb')));expect(rows()[0].w).toBeCloseTo(93.697,2);expect(input('Weight (lb)')).toBeTruthy();expect(rows()[0].manualFields.w).toBe(true)
})
it('rejects invalid text, negative/overflow loads, fractional reps and effort above the scale',()=>{
 mount({reps:10});for(const bad of ['-5','12abc','9'.repeat(400)]) {type(input('Weight (kg)'),bad);expect(rows()[0].w).toBe(40);expect(input('Weight (kg)').getAttribute('aria-invalid')).toBe('true');act(()=>input('Weight (kg)').blur())}
 type(input('Actual reps'),'2.5');expect(rows()[0].r).toBe(10);type(input('RIR'),'11');expect(rows()[0].rir).toBeUndefined();type(input('RIR'),'0');expect(rows()[0].rir).toBe(0);act(()=>input('RIR').blur());expect(input('RIR').value).toBe('Failure')
})
it('unlocks added weight for bodyweight and persists the visible editor at zero',()=>{
 mount({bodyweight:true,reps:10},[{w:0,r:10,done:false}]);expect(input('Added (kg)')).toBeUndefined();act(()=>[...container.querySelectorAll('button')].find(b=>b.textContent==='Log added weight').click());expect(input('Added (kg)')).toBeTruthy();type(input('Added (kg)'),'5.5');expect(rows()[0].w).toBe(5.5);expect(JSON.parse(localStorage.getItem('gym_state_v1')).active.entries[0].logAddedWeight).toBe(true)
})
it('records each side once and preserves a partially performed load from an earlier cascade',()=>{
 mount({side:true,repsPerSide:true,reps:10,repsMin:8,repRange:true},[{w:15,r:10,done:false},{w:15,r:10,done:false,leftDone:true}]);type(input('Weight (kg)'),'20');expect(rows()[1].w).toBe(15);type(input('Actual reps per side'),'8');act(()=>container.querySelectorAll('.set-sides button')[0].click());expect(rows()[0].done).toBe(false);act(()=>container.querySelectorAll('.set-sides button')[1].click());expect(rows()[0].done).toBe(true);expect(workoutVolume(state().active)).toBe(160);act(()=>container.querySelector('.set-undo').click());expect(workoutVolume(state().active)).toBe(0);expect(rows()[0]).toMatchObject({w:20,r:8,leftDone:false,rightDone:false})
})
it('adds and removes sets without changing previously recorded values',()=>{mount({reps:10});type(input('Weight (kg)'),'45');click('Add set');expect(rows()).toHaveLength(3);expect(rows()[2]).toMatchObject({w:45,r:10,done:false});click('Remove set');expect(rows()).toHaveLength(2);expect(rows()[0].w).toBe(45)})

it('accepts typed RPE and preserves exercise/session notes in history',()=>{
 mount({reps:10});act(()=>useStore.getState().update(s=>{s.effort='rpe';s.active.note='Session note';s.active.entries[0].note='Exercise note'}));
 type(input('RPE'),'1');type(input('RPE'),'10');expect(rows()[0].rpe).toBe(10);type(input('RPE'),'8,5');expect(rows()[0].rpe).toBe(8.5);
 act(()=>container.querySelector('[role="checkbox"]').click());act(()=>doFinishWorkout());expect(state().workouts[0]).toMatchObject({note:'Session note',entries:[{note:'Exercise note',sets:[{rpe:8.5},{done:false}]}]})
})

it('requires positive durations and accepts fractional cardio minutes',()=>{
 mount({mode:'cardio'},[{min:2,speed:8,done:false}]);type(input('Duration (min)'),'1,5');expect(rows()[0].min).toBe(1.5);type(input('Duration (min)'),'0');expect(rows()[0].min).toBe(1.5);expect(input('Duration (min)').getAttribute('aria-invalid')).toBe('true')
})

it('validates fixed and range reps without clamping intermediate typing or changing targets',()=>{
 mount({reps:12,repsMin:8,repRange:true});type(input('Actual reps'),'1');expect(rows()[0].r).toBe(10);expect(input('Actual reps').value).toBe('1');type(input('Actual reps'),'12');expect(rows()[0].r).toBe(12);type(input('Actual reps'),'15');expect(rows()[0].r).toBe(12);expect(input('Actual reps').getAttribute('aria-invalid')).toBe('true');act(()=>input('Actual reps').blur());expect(input('Actual reps').value).toBe('15');expect(input('Actual reps').getAttribute('aria-invalid')).toBe('true');type(input('Actual reps'),'12');
 act(()=>useStore.getState().update(s=>{s.active.entries[0].target={reps:8,repRange:false}}));type(input('Actual reps'),'8');expect(rows()[0].r).toBe(8);type(input('Actual reps'),'9');expect(rows()[0].r).toBe(8)
})
it('allows manual RIR on warm-up, top and backoff rows and persists it',()=>{
 mount({reps:8,setScheme:'topback',topRepsMax:5,backoffRepsMax:8},[{w:20,r:5,warmup:true,done:false},{w:50,r:5,role:'top',done:false},{w:40,r:8,role:'backoff',done:false}]);
 for(let i=0;i<3;i++)type(input('RIR',i),'2,5');expect(rows().map(s=>s.rir)).toEqual([2.5,2.5,2.5]);expect(JSON.parse(localStorage.getItem('gym_state_v1')).active.entries[0].sets[0].rir).toBe(2.5)
})

it('does not complete or collapse invalid drafts after blur and restores editing via explicit undo',()=>{
 mount({reps:10});type(input('Weight (kg)'),'-1');act(()=>input('Weight (kg)').blur());act(()=>container.querySelector('[role="checkbox"]').click());expect(rows()[0].done).toBe(false);expect(container.querySelector('.set-summary')).toBeNull();
 type(input('Weight (kg)'),'45.5');type(input('RIR'),'0');act(()=>container.querySelector('[role="checkbox"]').click());
 const summary=container.querySelector('.set-summary');expect(summary.textContent).toContain('45.5');expect(summary.textContent).toContain('Failure');expect(summary.querySelectorAll('input,.stp,.setextra,.set-sides')).toHaveLength(0);expect(summary.querySelectorAll('button')).toHaveLength(1);expect(container.querySelector('.set-console.current input')).toBeTruthy();
 act(()=>summary.querySelector('button').click());expect(rows()[0]).toMatchObject({done:false,w:45.5,r:10,rir:0});expect(input('Weight (kg)').value).toBe('45.5');expect(container.querySelector('.set-summary')).toBeNull();
})
it('collapses intensity extensions as read-only without changing their totals',()=>{
 mount({},[{w:40,r:10,rir:2,done:true,drops:[{w:30,r:8}],clusters:[{r:3,restSec:15}]},{w:40,r:10,done:false}]);
 expect(container.querySelector('.set-summary input')).toBeNull();expect(container.querySelector('.set-summary').textContent).toContain('40');expect(rows()[0].r).toBe(10)
})

it('renders Spanish completed results with decimal precision and an accessible undo action',async()=>{
 const {setLang}=await import('../lib/i18n.js')
 await act(async()=>{await setLang('es')})
 try {mount({},[{w:42.75,r:8,rir:2,done:true}]);const row=container.querySelector('.set-summary');expect(row.textContent).toContain('42,75');expect(row.textContent).toContain('RIR');expect(row.querySelector('button').getAttribute('aria-label')).toContain('Deshacer completada');expect(row.querySelector('input')).toBeNull()}
 finally {await act(async()=>{await setLang('en')})}
})


it('edits legacy per-side totals as single-side reps across completion, reload and undo',()=>{
 mount({side:true,reps:20,repsMin:12,repRange:true},[{w:20,r:16,done:false}])
 expect(input('Actual reps per side').value).toBe('8')
 expect(container.querySelector('.set-target strong').textContent).toBe('6–10')
 type(input('Actual reps per side'),'7');expect(rows()[0].r).toBe(14)
 act(()=>input('Actual reps per side').closest('.stp').querySelector('[aria-label="Increase"]').click())
 expect(input('Actual reps per side').value).toBe('8');expect(rows()[0].r).toBe(16)
 for(const side of container.querySelectorAll('.set-sides button'))act(()=>side.click())
 expect(rows()[0].done).toBe(true);expect(workoutVolume(state().active)).toBe(320)
 const repSummary=()=>[...container.querySelectorAll('.set-summary-values>div')].find(x=>x.querySelector('dt').textContent==='Actual reps per side').querySelector('dd').textContent
 expect(repSummary()).toBe('8')
 const saved=JSON.parse(localStorage.getItem('gym_state_v1'));expect(saved.active.entries[0].sets[0].r).toBe(16)
 act(()=>{root.unmount();root=createRoot(container);useStore.getState().replaceState(saved);root.render(<MemoryRouter><Workout/></MemoryRouter>)})
 expect(repSummary()).toBe('8');act(()=>container.querySelector('.set-undo').click());expect(input('Actual reps per side').value).toBe('8')
 expect(rows()[0]).toMatchObject({r:16,leftDone:false,rightDone:false,done:false})
})
it.each(['dropset','restpause'])('uses one-side counts for legacy %s editors and completed details',typeName=>{
 mount({side:true},[{w:20,r:16,done:false,type:typeName,...(typeName==='dropset'?{drops:[{w:15,r:12}]}:{clusters:[{r:4,restSec:15}]})}])
 const reps=()=>[...container.querySelectorAll('input[aria-label="Actual reps per side"]')]
 expect(reps().map(x=>x.value)).toEqual(['8',typeName==='dropset'?'6':'2'])
 type(reps()[1],'5');expect(rows()[0]).toMatchObject(typeName==='dropset'?{r:16,drops:[{r:10}]}:{r:22,clusters:[{r:10}]})
 expect(reps()[0].value).toBe(typeName==='dropset'?'8':'11')
 for(const side of container.querySelectorAll('.set-sides button'))act(()=>side.click())
 expect(container.querySelector('.set-summary-details').textContent).toContain('5 reps')
})
