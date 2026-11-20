// @vitest-environment happy-dom
import React, {act} from 'react'
import {createRoot} from 'react-dom/client'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import HistoryExerciseRow, {HistoryExerciseDetail,historySetGroups,historyResultUnit} from './HistoryExerciseDetail.jsx'
import {workoutDetailSheet} from '../sheets.jsx'
import {useStore,DEF} from '../store/useStore.js'
import {useUI} from '../store/useUI.js'
import {_setLangState} from '../lib/i18n-core.js'
import {bindUI} from './ui.jsx'

vi.mock('./Media.jsx',()=>({default:({ex})=><div data-media-id={ex.id} data-media-src={ex.img}/>,Thumb:({ex})=><span className="thumb" data-media-id={ex.id}/>}))
let host,root,initialState,initialStored,initialFlush
const entry=()=>({id:'history-custom',n:'Original snapshot',target:{mode:'reps',setScheme:'topback'},sets:[
  {phase:'warmup',w:30,r:6,done:true},{role:'top',w:90.25,r:5,rir:0,done:true},
  {role:'backoff',w:80,r:8,rpe:8.5,done:false},{role:'backoff',w:75,r:7,done:true,type:'dropset',drops:[{w:60,r:6}]},
  {w:70,r:12,done:true,type:'restpause',clusters:[{r:6,restSec:15},{r:4,restSec:15},{r:2,restSec:15}]},
]})
const workout=()=>({id:'history-one',d:'2026-11-02',name:'History routine',unit:'lb',vol:900,bw:185,bwUnit:'lb',entries:[entry()],prs:['history-custom']})
function Sheets(){return useUI(s=>s.sheets).map(sheet=><div role="dialog" key={sheet.id}>{sheet.render(()=>useUI.getState().closeSheet(sheet.id))}</div>)}
const pointer=(type,options={},target=host.querySelector('.history-exercise-row'))=>act(()=>target.dispatchEvent(new PointerEvent(type,{bubbles:true,button:0,pointerId:1,isPrimary:true,clientX:20,clientY:20,...options})))
const advance=ms=>act(()=>vi.advanceTimersByTime(ms))
const state=()=>useStore.getState().S
const mountRow=()=>act(()=>root.render(<><HistoryExerciseRow entry={state().workouts[0].entries[0]} workout={state().workouts[0]} pr/><Sheets/></>))
const openSavedSets=sets=>{
  const S={...state(),workouts:[{...workout(),entries:[{...entry(),sets}]}]}
  act(()=>useStore.setState({S}));localStorage.setItem('gym_state_v1',JSON.stringify(S))
  const saved=JSON.stringify(S),stored=localStorage.getItem('gym_state_v1')
  mountRow();pointer('pointerdown');advance(500)
  expect(host.querySelector('.history-exercise-detail')).not.toBeNull()
  return()=>{expect(JSON.stringify(state())).toBe(saved);expect(localStorage.getItem('gym_state_v1')).toBe(stored)}
}
beforeEach(()=>{
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;vi.useFakeTimers();_setLangState('en');bindUI(useUI)
  initialState=useStore.getState().S;initialStored=localStorage.getItem('gym_state_v1');initialFlush=useStore.getState().flushPersistence
  const S={...structuredClone(DEF),unit:'kg',workouts:[workout()],customEx:[{id:'history-custom',n:'My original exercise',custom:true,img:'data:image/png;base64,eA=='}],exerciseAliases:{'history-custom':'My saved alias'},routines:[{id:'routine',ex:[{id:'history-custom',sets:40,setScheme:'straight'}]}]}
  useStore.setState({S});localStorage.setItem('gym_state_v1',JSON.stringify(S));useUI.setState({sheets:[],toastMsg:''})
  host=document.createElement('div');document.body.append(host);root=createRoot(host)
})
afterEach(()=>{
  act(()=>{root.unmount();useUI.getState().closeAll()});host.remove();vi.restoreAllMocks();useStore.setState({S:initialState,flushPersistence:initialFlush})
  if(initialStored==null)localStorage.removeItem('gym_state_v1');else localStorage.setItem('gym_state_v1',initialStored)
  vi.clearAllTimers();vi.useRealTimers()
})
it('opens only after a full 0.5-second hold and preserves every saved field and storage byte',()=>{
  const before=JSON.stringify(state()),stored=localStorage.getItem('gym_state_v1');mountRow()
  expect(host.querySelector('.history-exercise-row').textContent).toContain('My saved alias')
  expect(host.querySelector('.history-exercise-row').style.getPropertyValue('--history-exercise-hold-duration')).toBe('500ms')
  expect(host.querySelector('.history-exercise-row').textContent).not.toMatch(/90|Back-off|Set 1/)
  pointer('pointerdown');advance(499);expect(useUI.getState().sheets).toHaveLength(0)
  advance(1);expect(useUI.getState().sheets).toHaveLength(1)
  expect(host.querySelector('.history-exercise-detail [data-media-id]').dataset.mediaId).toBe('history-custom')
  expect(host.querySelector('.history-exercise-detail h3').textContent).toBe('My saved alias')
  expect([...host.querySelectorAll('[data-set-kind]')].map(group=>group.dataset.setKind)).toEqual(['warmup','top','backoff','work'])
  expect([...host.querySelectorAll('[data-set-index]')].map(row=>row.dataset.setIndex)).toEqual(['0','1','2','3','4'])
  expect(host.querySelector('[data-set-index="2"]').textContent).toContain('Pending')
  expect(host.querySelector('[data-set-index="1"]').textContent).toContain('Failure')
  expect(host.querySelector('[data-set-index="1"]').textContent).toContain('90 lb')
  expect(host.querySelector('[data-set-index="3"]').textContent).toContain('60 lb × 6 reps')
  expect(host.querySelector('[data-set-index="4"]').textContent).toContain('Burst 3')
  expect(host.querySelector('.history-exercise-detail').textContent).not.toContain('kg')
  pointer('pointerup');advance(3000);expect(useUI.getState().sheets).toHaveLength(1)
  act(()=>useUI.getState().closeAll());expect(host.querySelector('.history-exercise-detail')).toBeNull()
  expect(JSON.stringify(state())).toBe(before);expect(localStorage.getItem('gym_state_v1')).toBe(stored)
})
it.each([
  ['dropset','drops',[{w:60,r:4},{w:45,r:7}],['Drop 1','Drop 2'],['60 lb','45 lb']],
  ['restpause','clusters',[{r:6,restSec:15},{r:3,restSec:20}],['Burst 1','Burst 2'],['6 reps','3 reps']],
])('opens saved %s details and retains valid nested results after malformed rows', (type,key,valid,labels,results)=>{
  const unchanged=openSavedSets([{type,w:70,r:9,done:true,[key]:[null,false,12,'invalid',[],...valid]}])
  const rows=[...host.querySelectorAll('.history-exercise-extras li')]
  expect(rows).toHaveLength(2)
  expect(rows.map(row=>row.querySelector('b').textContent)).toEqual(labels)
  rows.forEach((row,index)=>expect(row.textContent).toContain(results[index]))
  expect(host.querySelector('.history-exercise-set').textContent).toContain('70 lb')
  unchanged()
})
it('keeps main results readable without an empty extras list when saved nested rows are all malformed',()=>{
  const malformed=[null,false,12,'invalid',[]]
  const unchanged=openSavedSets([
    {type:'dropset',w:80,r:6,done:true,drops:malformed},
    {type:'restpause',w:65,r:8,done:true,clusters:malformed},
  ])
  expect(host.querySelectorAll('.history-exercise-set')).toHaveLength(2)
  expect(host.querySelector('.history-exercise-extras')).toBeNull()
  const text=host.querySelector('.history-exercise-detail').textContent
  expect(text).toContain('80 lb');expect(text).toContain('65 lb')
  unchanged()
})
it.each(['pointerup','pointercancel','pointerleave','pointermove','scroll','blur','touchcancel','multitouch','secondary-pointer'])('cancels an incomplete hold on %s without opening another sheet',kind=>{
  mountRow();pointer('pointerdown');advance(200)
  if(kind==='scroll')act(()=>document.dispatchEvent(new Event('scroll')))
  else if(kind==='blur')act(()=>window.dispatchEvent(new Event('blur')))
  else if(kind==='multitouch'){const event=new Event('touchstart',{bubbles:true});Object.defineProperty(event,'touches',{value:[{},{}]});act(()=>document.dispatchEvent(event))}
  else if(kind==='secondary-pointer')pointer('pointerdown',{pointerId:2,isPrimary:false},window)
  else if(kind==='touchcancel')act(()=>host.querySelector('.history-exercise-row').dispatchEvent(new Event('touchcancel',{bubbles:true})))
  else if(kind==='pointerleave')pointer('pointerout',{relatedTarget:document.body})
  else pointer(kind,kind==='pointermove'?{clientX:29}:{})
  advance(3000);expect(useUI.getState().sheets).toHaveLength(0)
})
it.each([
  ['touch',10,0,true],['touch',10,8,true],['touch',14,0,true],
  ['touch',15,0,false],['touch',11,10,false],
  ['mouse',9,0,false],['pen',9,0,false],['',9,0,false],
])('recognizes a %s hold with %ipx/%ipx travel using its own movement tolerance', (pointerType,dx,dy,opens)=>{
  mountRow();pointer('pointerdown',{pointerType});advance(200)
  const move=new PointerEvent('pointermove',{bubbles:true,cancelable:true,pointerId:1,pointerType,clientX:20+dx,clientY:20+dy})
  act(()=>host.querySelector('.history-exercise-row').dispatchEvent(move))
  expect(move.defaultPrevented).toBe(false)
  advance(299);expect(useUI.getState().sheets).toHaveLength(0)
  advance(1);expect(useUI.getState().sheets).toHaveLength(opens?1:0)
  pointer('pointerup',{pointerType});advance(2500)
  expect(useUI.getState().sheets).toHaveLength(opens?1:0)
})
it.each(['scroll','pointercancel','multitouch'])('still cancels a drifting touch hold on %s',kind=>{
  mountRow();pointer('pointerdown',{pointerType:'touch'});advance(200)
  pointer('pointermove',{pointerType:'touch',clientX:30});advance(200)
  expect(host.querySelector('.history-exercise-row').classList.contains('is-holding')).toBe(true)
  if(kind==='scroll')act(()=>host.querySelector('.history-exercise-row').parentElement.dispatchEvent(new Event('scroll')))
  else if(kind==='multitouch'){
    const event=new Event('touchstart',{bubbles:true});Object.defineProperty(event,'touches',{value:[{},{}]})
    act(()=>document.dispatchEvent(event))
  }else pointer('pointercancel',{pointerType:'touch'})
  advance(3000);expect(useUI.getState().sheets).toHaveLength(0)
  expect(host.querySelector('.history-exercise-row').classList.contains('is-holding')).toBe(false)
})
it('ignores a short pointer click and permits immediate keyboard/assistive activation exactly once',()=>{
  mountRow();pointer('pointerdown');advance(100);pointer('pointerup')
  act(()=>host.querySelector('.history-exercise-row').dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1})))
  expect(useUI.getState().sheets).toHaveLength(0)
  act(()=>host.querySelector('.history-exercise-row').click());expect(useUI.getState().sheets).toHaveLength(1)
  act(()=>host.querySelector('.history-exercise-row').click());expect(useUI.getState().sheets).toHaveLength(1)
})
it('cancels native image dragging even when no pointerup or pointercancel follows',()=>{
  mountRow();const row=host.querySelector('.history-exercise-row'),image=document.createElement('img');row.querySelector('.thumb').append(image)
  pointer('pointerdown');advance(200)
  const drag=new Event('dragstart',{bubbles:true,cancelable:true});act(()=>image.dispatchEvent(drag))
  expect(drag.defaultPrevented).toBe(true);advance(3000);expect(useUI.getState().sheets).toHaveLength(0)
  // Ordinary pointer movement still belongs to scrolling, without prevention.
  const move=new PointerEvent('pointermove',{bubbles:true,cancelable:true,pointerId:1,clientX:40,clientY:60})
  pointer('pointerdown');act(()=>row.dispatchEvent(move));expect(move.defaultPrevented).toBe(false)
  advance(3000);expect(useUI.getState().sheets).toHaveLength(0)
})
it('also cancels a pending hold when a drag starts outside that exercise row',()=>{
  mountRow();pointer('pointerdown');advance(200)
  const drag=new Event('dragstart',{bubbles:true,cancelable:true});act(()=>document.dispatchEvent(drag))
  expect(drag.defaultPrevented).toBe(false);advance(3000);expect(useUI.getState().sheets).toHaveLength(0)
})
it('cancels on unmount or when the source sheet becomes inert',()=>{
  mountRow();pointer('pointerdown');advance(200);act(()=>root.render(null));advance(3000)
  expect(useUI.getState().sheets).toHaveLength(0)
  mountRow();pointer('pointerdown');host.setAttribute('inert','');advance(500)
  expect(useUI.getState().sheets).toHaveLength(0);host.removeAttribute('inert')
})
it('uses only historical row roles in their saved order, including a phase that overrides legacy warmup',()=>{
  const saved={sets:[{role:'backoff'},{role:'top'},{warmup:true,phase:'work'},{warmup:true},{role:'top'}]}
  expect(historySetGroups(saved).map(group=>group.kind)).toEqual(['backoff','top','work','warmup','top'])
  expect(historySetGroups({sets:[]})).toEqual([])
  expect(historyResultUnit({unit:'kg'},{unit:'lb'},{unit:'lb'},{unit:'lb'})).toBe('kg')
  expect(historyResultUnit({}, {target:{unit:'kg'}}, {unit:'lb'}, {unit:'kg'})).toBe('lb')
})
it('preserves legacy per-side repetitions, partial confirmations, times and cardio without a current target',()=>{
  const saved={id:'deleted',n:'Saved deleted exercise',target:{side:true},sets:[
    {r:16,w:20,unit:'kg',done:false,leftDone:true,rightDone:false},
    {sec:90,leftSec:85,rightSec:92,w:0,done:true},
    {mode:'cardio',min:12.5,speed:8.25,done:true},
  ]}
  const before=structuredClone(saved);act(()=>root.render(<HistoryExerciseDetail entry={saved} workout={state().workouts[0]}/>))
  const rows=host.querySelectorAll('[data-set-index]')
  expect(rows[0].textContent).toContain('20 kg');expect(rows[0].textContent).toContain('Reps8')
  expect(rows[0].textContent).toContain('Left: Completed');expect(rows[0].textContent).toContain('Right: Pending')
  expect(rows[1].textContent).toContain('1:30');expect(rows[1].textContent).toContain('1:25');expect(rows[1].textContent).toContain('1:32')
  expect(rows[2].textContent).toContain('12.5');expect(rows[2].textContent).toContain('8.25')
  expect(host.querySelector('h3').textContent).toBe('Saved deleted exercise');expect(saved).toEqual(before)
})
it('keeps the workout list compact and preserves historical units while editing and cancelling',()=>{
  act(()=>root.render(<Sheets/>));act(()=>workoutDetailSheet(state().workouts[0]))
  const before=JSON.stringify(state()),stored=localStorage.getItem('gym_state_v1')
  expect(host.querySelector('.history-exercise-row')).not.toBeNull()
  expect(host.textContent).toContain('900 lb');expect(host.textContent).toContain('185 lb')
  expect(host.querySelector('.ss')).toBeNull()
  const button=label=>[...host.querySelectorAll('button')].find(node=>node.textContent===label)
  act(()=>button('Edit workout').click())
  expect(host.querySelector('.history-exercise-row')).toBeNull()
  expect(host.querySelector('input[aria-label="Weight (lb)"]')).not.toBeNull()
  expect(host.querySelector('input[aria-label="Weight (kg)"]')).toBeNull()
  act(()=>button('Cancel').click());expect(JSON.stringify(state())).toBe(before);expect(localStorage.getItem('gym_state_v1')).toBe(stored)
})
const exactButton=label=>[...host.querySelectorAll('button')].filter(node=>node.textContent===label).at(-1)
const openEditor=async()=>{
  await act(()=>root.render(<Sheets/>));await act(()=>workoutDetailSheet(state().workouts[0]));await act(()=>exactButton('Edit workout').click())
}
const enterNote=async value=>act(()=>{
  const textarea=host.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(textarea,value);textarea.dispatchEvent(new Event('input',{bubbles:true}))
})
const confirmEdit=async()=>{await act(()=>exactButton('Save changes').click());await act(()=>exactButton('Save changes').click())}
it('refuses to overwrite a workout changed by another source after editing started',async()=>{
  await openEditor();await enterNote('My local draft')
  const external=structuredClone(state());external.workouts[0].entries[0].sets[1].r=9;external.workouts[0].note='Externally saved note'
  await act(()=>useStore.setState({S:external}));localStorage.setItem('gym_state_v1',JSON.stringify(external));const stored=localStorage.getItem('gym_state_v1')
  await confirmEdit()
  expect(state()).toEqual(external);expect(localStorage.getItem('gym_state_v1')).toBe(stored)
  expect(host.querySelector('[role="alert"]').textContent).toContain('changed while you were editing')
  expect(host.querySelector('textarea').value).toBe('My local draft');expect(exactButton('Save changes')).not.toBeNull()
  expect(useUI.getState().toastMsg).not.toBe('Workout updated')
})
it('keeps a quota-failed edit visible and permits one successful retry without false success or duplication',async()=>{
  await openEditor();await enterNote('Quota retry note')
  const before=structuredClone(state()),stored=localStorage.getItem('gym_state_v1'),original=localStorage.setItem.bind(localStorage)
  const failed=vi.spyOn(localStorage,'setItem').mockImplementation((key,value)=>{if(key==='gym_state_v1')throw new DOMException('Quota exceeded','QuotaExceededError');return original(key,value)})
  await confirmEdit()
  expect(state()).toEqual(before);expect(localStorage.getItem('gym_state_v1')).toBe(stored)
  expect(host.querySelector('[role="alert"]').textContent).toContain('Could not save')
  expect(host.querySelector('textarea').value).toBe('Quota retry note');expect(useUI.getState().toastMsg).not.toBe('Workout updated')
  failed.mockRestore();await confirmEdit()
  expect(state().workouts).toHaveLength(1);expect(state().workouts[0].note).toBe('Quota retry note')
  expect(host.querySelector('.history-exercise-row')).not.toBeNull();expect(useUI.getState().toastMsg).toBe('Workout updated')
})
it('waits for the durable mirror, locks the draft during saving, and retries a mirror failure safely',async()=>{
  let rejectMirror
  const first=new Promise((_,reject)=>{rejectMirror=reject}),flush=vi.fn().mockReturnValueOnce(first).mockResolvedValue()
  useStore.setState({flushPersistence:flush});await openEditor();await enterNote('Durable note')
  await confirmEdit()
  expect(state().workouts[0].note).toBe('Durable note');expect(host.querySelector('fieldset').disabled).toBe(true)
  expect(useUI.getState().toastMsg).not.toBe('Workout updated')
  await act(async()=>{rejectMirror(new Error('Native storage unavailable'));await first.catch(()=>{})})
  expect(host.querySelector('fieldset').disabled).toBe(false);expect(host.querySelector('[role="alert"]').textContent).toContain('Could not save')
  await confirmEdit()
  expect(flush).toHaveBeenCalledTimes(2);expect(state().workouts).toHaveLength(1);expect(state().workouts[0].note).toBe('Durable note')
  expect(host.querySelector('.history-exercise-row')).not.toBeNull();expect(useUI.getState().toastMsg).toBe('Workout updated')
})
it('seeds the editor from the latest record at Edit instead of an obsolete mounted draft',async()=>{
  await act(()=>root.render(<Sheets/>));await act(()=>workoutDetailSheet(state().workouts[0]))
  const latest=structuredClone(state());latest.workouts[0].note='Saved before editing';latest.workouts[0].entries[0].sets[1].r=11
  await act(()=>useStore.setState({S:latest}));await act(()=>exactButton('Edit workout').click())
  expect(host.querySelector('textarea').value).toBe('Saved before editing');await confirmEdit()
  expect(state().workouts[0].entries[0].sets[1].r).toBe(11);expect(state().workouts[0].note).toBe('Saved before editing')
})

// Contact timestamps distinguish a full hold from a short release queued while
// the main thread is busy. Leave the timer pending in these release-order cases.
const timedPointer=(type,stamp,options={},target=host.querySelector('.history-exercise-row'))=>{
  const event=new PointerEvent(type,{bubbles:true,button:0,pointerId:1,isPrimary:true,clientX:20,clientY:20,...options})
  Object.defineProperty(event,'timeStamp',{value:stamp})
  act(()=>target.dispatchEvent(event))
}
it('opens a completed 0.5-second hold when release arrives before its overdue timer',()=>{
  mountRow();timedPointer('pointerdown',100);timedPointer('pointerup',600)
  expect(useUI.getState().sheets).toHaveLength(1)
  const ids=useUI.getState().sheets.map(sheet=>sheet.id)
  advance(5000);expect(useUI.getState().sheets.map(sheet=>sheet.id)).toEqual(ids)
})
it('does not turn a queued short release into a hold by using its late processing time',()=>{
  mountRow();let now=100;vi.spyOn(performance,'now').mockImplementation(()=>now)
  timedPointer('pointerdown',100);now=5000;timedPointer('pointerup',599)
  expect(useUI.getState().sheets).toHaveLength(0)
  advance(5000);expect(useUI.getState().sheets).toHaveLength(0)
})
it.each(['scroll','pointercancel','pointerleave','pointermove','multitouch','blur'])('never revives a cancelled %s hold on a late release',kind=>{
  mountRow();timedPointer('pointerdown',100)
  if(kind==='scroll')act(()=>document.dispatchEvent(new Event('scroll')))
  else if(kind==='blur')act(()=>window.dispatchEvent(new Event('blur')))
  else if(kind==='multitouch'){
    const event=new Event('touchstart',{bubbles:true});Object.defineProperty(event,'touches',{value:[{},{}]})
    act(()=>document.dispatchEvent(event))
  }else if(kind==='pointerleave')pointer('pointerout',{relatedTarget:document.body})
  else timedPointer(kind,150,{clientX:kind==='pointermove'?40:20})
  timedPointer('pointerup',2500);advance(5000)
  expect(useUI.getState().sheets).toHaveLength(0)
})
it('rejects release outside the movement tolerance even without a delivered move event',()=>{
  mountRow();timedPointer('pointerdown',100,{pointerType:'touch'});timedPointer('pointerup',2300,{pointerType:'touch',clientX:35})
  advance(5000);expect(useUI.getState().sheets).toHaveLength(0)
})
it('cancels a late window release outside the exercise instead of opening it',()=>{
  mountRow();timedPointer('pointerdown',100);timedPointer('pointerup',2500,{},window)
  advance(5000);expect(useUI.getState().sheets).toHaveLength(0)
})
it('does not duplicate a detail already opened by the timer on release or assistive click',()=>{
  mountRow();timedPointer('pointerdown',100);advance(500)
  const ids=useUI.getState().sheets.map(sheet=>sheet.id);expect(ids).toHaveLength(1)
  timedPointer('pointerup',2300)
  act(()=>host.querySelector('.history-exercise-row').click());advance(5000)
  expect(useUI.getState().sheets.map(sheet=>sheet.id)).toEqual(ids)
})
it('uses monotonic processing time only when event timestamps are unavailable',()=>{
  mountRow();let now=100;vi.spyOn(performance,'now').mockImplementation(()=>now)
  timedPointer('pointerdown',NaN);now=599;timedPointer('pointerup',NaN)
  expect(useUI.getState().sheets).toHaveLength(0)
  now=3000;timedPointer('pointerdown',NaN);now=3500;timedPointer('pointerup',NaN)
  expect(useUI.getState().sheets).toHaveLength(1)
})
it('does not fall back to processing time for backwards but available event timestamps',()=>{
  mountRow();let now=100;vi.spyOn(performance,'now').mockImplementation(()=>now)
  timedPointer('pointerdown',100);now=5000;timedPointer('pointerup',50)
  advance(5000);expect(useUI.getState().sheets).toHaveLength(0)
})
it('still refuses a completed hold if its source became inert before release',()=>{
  mountRow();timedPointer('pointerdown',100);host.setAttribute('inert','');timedPointer('pointerup',2200)
  advance(5000);expect(useUI.getState().sheets).toHaveLength(0)
})
it.each(['area','icon'])('opens saved sets with one short tap on the expand %s without editing data',kind=>{
  const before=JSON.stringify(state()),stored=localStorage.getItem('gym_state_v1');mountRow()
  const row=host.querySelector('.history-exercise-row'),area=row.querySelector('[data-history-open]'),target=kind==='icon'?area.querySelector('svg'):area
  expect(row.tagName).toBe('BUTTON');expect(row.querySelector('button')).toBeNull();expect(row.hasAttribute('title')).toBe(false)
  pointer('pointerdown',{},target);advance(80);pointer('pointerup',{},target)
  act(()=>target.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1})))
  expect(useUI.getState().sheets).toHaveLength(1);const id=useUI.getState().sheets[0].id
  act(()=>target.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1})))
  expect(useUI.getState().sheets.map(sheet=>sheet.id)).toEqual([id])
  expect(host.querySelector('.history-exercise-detail')).not.toBeNull()
  expect(JSON.stringify(state())).toBe(before);expect(localStorage.getItem('gym_state_v1')).toBe(stored)
})
it.each(['.history-exercise-row-copy','.thumb'])('keeps a short tap on %s from opening saved sets',selector=>{
  const before=JSON.stringify(state()),stored=localStorage.getItem('gym_state_v1');mountRow()
  const target=host.querySelector('.history-exercise-row').querySelector(selector)
  pointer('pointerdown',{},target);advance(80);pointer('pointerup',{},target)
  act(()=>target.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1})));advance(2500)
  expect(useUI.getState().sheets).toHaveLength(0)
  expect(JSON.stringify(state())).toBe(before);expect(localStorage.getItem('gym_state_v1')).toBe(stored)
})
it('does not open another detail from the expand compatibility click after a complete hold',()=>{
  const before=JSON.stringify(state()),stored=localStorage.getItem('gym_state_v1');mountRow()
  const area=host.querySelector('[data-history-open]')
  pointer('pointerdown',{},area);advance(500);expect(useUI.getState().sheets).toHaveLength(1)
  const id=useUI.getState().sheets[0].id
  pointer('pointerup',{},area);act(()=>area.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1})));advance(2500)
  expect(useUI.getState().sheets.map(sheet=>sheet.id)).toEqual([id])
  expect(JSON.stringify(state())).toBe(before);expect(localStorage.getItem('gym_state_v1')).toBe(stored)
})
