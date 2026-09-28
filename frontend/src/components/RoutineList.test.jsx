// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {it,expect,vi,beforeEach,afterEach} from 'vitest'
import RoutineList from './RoutineList.jsx'
import {useStore,DEF} from '../store/useStore.js'
import {reorderRoutine,orderedRoutines} from '../lib/routine-order.js'
vi.mock('../lib/i18n.js',()=>({t:s=>s}))
vi.mock('../lib/sound.js',()=>({vibrate:vi.fn()}))
let root,host,open,del
function Harness(){const S=useStore(s=>s.S);return <RoutineList S={S} onOpen={open} onDelete={del} onInfo={()=>{}} onReorder={(id,target)=>useStore.getState().update(s=>reorderRoutine(s,id,target))}/>}
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;vi.useFakeTimers();localStorage.clear();host=document.createElement('div');document.body.append(host);root=createRoot(host);open=vi.fn();del=vi.fn();vi.spyOn(window,'scrollBy').mockImplementation(()=>{})})
afterEach(()=>{act(()=>root.unmount());host.remove();vi.clearAllTimers();vi.useRealTimers();vi.restoreAllMocks()})
const mount=n=>{useStore.setState({user:null,S:{...structuredClone(DEF),routines:Array.from({length:n},(_,i)=>({id:'r'+i,name:'Routine '+i,ex:[]}))}});act(()=>root.render(<Harness/>));host.querySelectorAll('[data-routine-id]').forEach((el,i)=>el.getBoundingClientRect=()=>({top:100+i*80,bottom:180+i*80,width:300,height:80}))}
const event=(el,type,x,y)=>act(()=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerType:'mouse',button:0,pointerId:1,clientX:x,clientY:y})))
it.each([2,5,20])('long presses and drops across %i routines without opening or deleting',n=>{
 mount(n);const row=host.querySelector('.swipe-content');event(row,'pointerdown',100,120);act(()=>vi.advanceTimersByTime(2499));expect(host.querySelector('.dragging')).toBeNull();act(()=>vi.advanceTimersByTime(1));expect(host.querySelector('.dragging')).not.toBeNull();event(row,'pointermove',100,120+80*(n-1));event(row,'pointerup',100,120+80*(n-1));act(()=>row.click());expect(open).not.toHaveBeenCalled();expect(del).not.toHaveBeenCalled();expect(orderedRoutines(useStore.getState().S).at(-1).id).toBe('r0');expect(JSON.parse(localStorage.getItem('gym_state_v1')).routineOrder.at(-1)).toBe('r0')
})
it('cancels long press on scrolling and pointer cancellation without persisting an order',()=>{
 mount(5);const row=host.querySelector('.swipe-content');event(row,'pointerdown',100,120);event(row,'pointermove',100,150);act(()=>vi.advanceTimersByTime(2600));expect(host.querySelector('.dragging')).toBeNull();event(row,'pointercancel',100,150);expect(localStorage.getItem('gym_state_v1')).toBeNull()
})
it('keeps quick taps and swipe-to-delete and offers keyboard/touch move buttons',()=>{
 mount(2);const row=host.querySelector('.swipe-content');event(row,'pointerdown',200,120);event(row,'pointerup',200,120);act(()=>row.click());expect(open).toHaveBeenCalledWith('r0');event(row,'pointerdown',280,120);event(row,'pointermove',30,120);event(row,'pointerup',30,120);expect(del).toHaveBeenCalledWith(expect.objectContaining({id:'r0'}));act(()=>host.querySelector('[aria-label="Reorder routine · Routine 0"]').click());act(()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Move down').click());expect(orderedRoutines(useStore.getState().S)[1].id).toBe('r0')
})

it('handles native touch long-press/drop and prevents scroll only after activation',()=>{
 mount(5);const row=host.querySelector('.swipe-content');const touch=(target,type,x,y)=>{const e=new Event(type,{bubbles:true,cancelable:true});Object.defineProperty(e,'touches',{value:type==='touchend'||type==='touchcancel'?[]:[{clientX:x,clientY:y}]});act(()=>target.dispatchEvent(e));return e};
 touch(row,'touchstart',100,120);const before=touch(row,'touchmove',101,121);expect(before.defaultPrevented).toBe(false);act(()=>vi.advanceTimersByTime(2500));const move=touch(row,'touchmove',100,450);expect(move.defaultPrevented).toBe(true);touch(row,'touchend',100,450);act(()=>row.click());expect(orderedRoutines(useStore.getState().S).at(-1).id).toBe('r0');expect(open).not.toHaveBeenCalled();expect(del).not.toHaveBeenCalled()
})
