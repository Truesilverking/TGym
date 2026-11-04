// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {it,expect,vi,beforeEach,afterEach} from 'vitest'
import RoutineList,{REORDER_HOLD_MS} from './RoutineList.jsx'
import {useStore,DEF} from '../store/useStore.js'
import {reorderRoutine,orderedRoutines} from '../lib/routine-order.js'
vi.mock('../lib/i18n.js',()=>({t:s=>s}))
vi.mock('../lib/sound.js',()=>({vibrate:vi.fn()}))
let root,host,open,del,info
function Harness(){const S=useStore(s=>s.S);return <RoutineList S={S} onOpen={open} onDelete={del} onInfo={info} onReorder={(id,target)=>useStore.getState().update(s=>reorderRoutine(s,id,target))}/>}
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;vi.useFakeTimers();localStorage.clear();host=document.createElement('div');document.body.append(host);root=createRoot(host);open=vi.fn();del=vi.fn();info=vi.fn();vi.spyOn(window,'scrollBy').mockImplementation(()=>{})})
afterEach(()=>{act(()=>root.unmount());host.remove();vi.clearAllTimers();vi.useRealTimers();vi.restoreAllMocks()})
const mount=n=>{useStore.setState({user:null,S:{...structuredClone(DEF),routines:Array.from({length:n},(_,i)=>({id:'r'+i,name:'Routine '+i,ex:[]}))}});act(()=>root.render(<Harness/>));host.querySelectorAll('[data-routine-id]').forEach((el,i)=>el.getBoundingClientRect=()=>({top:100+i*80,bottom:180+i*80,width:300,height:80}))}
const event=(el,type,x,y)=>act(()=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerType:'mouse',button:0,pointerId:1,clientX:x,clientY:y})))
it.each([2,5,20])('long presses and drops across %i routines without opening or deleting',n=>{
 mount(n);const row=host.querySelector('.swipe-content');event(row,'pointerdown',100,120);act(()=>vi.advanceTimersByTime(REORDER_HOLD_MS-1));expect(host.querySelector('.dragging')).toBeNull();act(()=>vi.advanceTimersByTime(1));expect(host.querySelector('.dragging')).not.toBeNull();event(row,'pointermove',100,120+80*(n-1));event(row,'pointerup',100,120+80*(n-1));act(()=>row.click());expect(open).not.toHaveBeenCalled();expect(del).not.toHaveBeenCalled();expect(orderedRoutines(useStore.getState().S).at(-1).id).toBe('r0');expect(JSON.parse(localStorage.getItem('gym_state_v1')).routineOrder.at(-1)).toBe('r0')
})
it('cancels long press on scrolling and pointer cancellation without persisting an order',()=>{
 mount(5);const row=host.querySelector('.swipe-content');event(row,'pointerdown',100,120);event(row,'pointermove',100,150);act(()=>vi.advanceTimersByTime(2600));expect(host.querySelector('.dragging')).toBeNull();event(row,'pointercancel',100,150);expect(localStorage.getItem('gym_state_v1')).toBeNull()
})
it('keeps quick taps and swipe-to-delete and offers keyboard/touch move buttons',()=>{
 mount(2);const row=host.querySelector('.swipe-content');event(row,'pointerdown',200,120);event(row,'pointerup',200,120);act(()=>row.click());expect(open).toHaveBeenCalledWith('r0');event(row,'pointerdown',280,120);event(row,'pointermove',30,120);event(row,'pointerup',30,120);expect(del).toHaveBeenCalledWith(expect.objectContaining({id:'r0'}));act(()=>host.querySelector('[aria-label="Move down · Routine 0"]').click());expect(orderedRoutines(useStore.getState().S)[1].id).toBe('r0')
})

it('handles native touch long-press/drop and prevents scroll only after activation',()=>{
 mount(5);const row=host.querySelector('.swipe-content');const touch=(target,type,x,y)=>{const e=new Event(type,{bubbles:true,cancelable:true});Object.defineProperty(e,'touches',{value:type==='touchend'||type==='touchcancel'?[]:[{clientX:x,clientY:y}]});act(()=>target.dispatchEvent(e));return e};
 touch(row,'touchstart',100,120);const before=touch(row,'touchmove',101,121);expect(before.defaultPrevented).toBe(false);act(()=>vi.advanceTimersByTime(REORDER_HOLD_MS));const move=touch(row,'touchmove',100,450);expect(move.defaultPrevented).toBe(true);touch(row,'touchend',100,450);act(()=>row.click());expect(orderedRoutines(useStore.getState().S).at(-1).id).toBe('r0');expect(open).not.toHaveBeenCalled();expect(del).not.toHaveBeenCalled()
})

it('keeps arrows visible, bounded and independent of open/info, then alternates drag and arrows',()=>{
 mount(5);const up=id=>host.querySelector(`[data-routine-id="${id}"] [title="Move up"]`),down=id=>host.querySelector(`[data-routine-id="${id}"] [title="Move down"]`);
 expect(up('r0').disabled).toBe(true);expect(down('r4').disabled).toBe(true);expect(host.textContent).not.toContain('Hold a routine');
 act(()=>down('r0').click());act(()=>down('r0').click());expect(orderedRoutines(useStore.getState().S).map(r=>r.id)).toEqual(['r1','r2','r0','r3','r4']);act(()=>up('r0').click());
 const row=host.querySelector('[data-routine-id="r0"] .swipe-content');event(row,'pointerdown',100,200);act(()=>vi.advanceTimersByTime(REORDER_HOLD_MS));event(document,'pointermove',100,999);event(document,'pointerup',100,999);expect(orderedRoutines(useStore.getState().S).at(-1).id).toBe('r0');
 act(()=>up('r0').click());expect(orderedRoutines(useStore.getState().S).at(-2).id).toBe('r0');expect(open).not.toHaveBeenCalled();expect(del).not.toHaveBeenCalled();act(()=>host.querySelector('[data-routine-id="r0"] [aria-label="Muscles trained"]').click());expect(info).toHaveBeenCalledWith('r0');expect(open).not.toHaveBeenCalled();
 const saved=JSON.parse(localStorage.getItem('gym_state_v1'));act(()=>useStore.setState({S:saved}));expect(orderedRoutines(useStore.getState().S).map(r=>r.id)).toEqual(saved.routineOrder);
})
it('tolerates finger jitter but cancels real scroll and never opens after cancel',()=>{
 mount(2);const row=host.querySelector('.swipe-content');event(row,'pointerdown',100,120);event(document,'pointermove',109,122);act(()=>vi.advanceTimersByTime(REORDER_HOLD_MS));expect(host.querySelector('.dragging')).not.toBeNull();event(document,'pointercancel',109,122);act(()=>row.click());expect(open).not.toHaveBeenCalled();
 event(row,'pointerdown',100,120);event(document,'pointermove',101,150);act(()=>vi.advanceTimersByTime(REORDER_HOLD_MS));expect(host.querySelector('.dragging')).toBeNull();event(document,'pointerup',101,150);act(()=>row.click());expect(open).not.toHaveBeenCalled();
 event(row,'pointerdown',100,120);event(document,'pointerup',100,120);act(()=>row.click());expect(open).toHaveBeenCalledWith('r0');
})

it('prevents the browser native drag competing with list reordering',()=>{
 mount(2);const e=new Event('dragstart',{bubbles:true,cancelable:true});act(()=>host.querySelector('.swipe-content').dispatchEvent(e));expect(e.defaultPrevented).toBe(true)
})

it('can swipe to delete from the name area beside the permanent arrow buttons',()=>{
 mount(2);const row=host.querySelector('.swipe-content');event(row,'pointerdown',175,120);event(document,'pointermove',10,120);expect(host.querySelector('.armed')).not.toBeNull();event(document,'pointerup',10,120);expect(del).toHaveBeenCalledWith(expect.objectContaining({id:'r0'}));act(()=>row.click());expect(open).not.toHaveBeenCalled()
})
