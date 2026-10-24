// @vitest-environment happy-dom
import React,{act,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import BodyWeightPicker from './BodyWeightPicker.jsx'
import {setLang,t} from '../lib/i18n.js'

let host,root,changed,setCanonical,now,frames,nextFrame,media,listeners,storageWrite,parentRenders
beforeEach(async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;await setLang('en');localStorage.clear()
 document.documentElement.classList.remove('reduceMotion');delete document.documentElement.dataset.reduceMotion
 changed=vi.fn();now=0;frames=new Map();nextFrame=0;listeners=new Set();parentRenders=0
 media={matches:false,addEventListener:(_,fn)=>listeners.add(fn),removeEventListener:(_,fn)=>listeners.delete(fn)}
 vi.spyOn(window,'matchMedia').mockReturnValue(media)
 vi.spyOn(performance,'now').mockImplementation(()=>now)
 vi.spyOn(globalThis,'requestAnimationFrame').mockImplementation(fn=>{const id=++nextFrame;frames.set(id,fn);return id})
 vi.spyOn(globalThis,'cancelAnimationFrame').mockImplementation(id=>frames.delete(id))
 storageWrite=vi.spyOn(Storage.prototype,'setItem')
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
})
afterEach(async()=>{
 if(root)await act(()=>root.unmount())
 expect(frames.size).toBe(0);expect(storageWrite).not.toHaveBeenCalled()
 host.remove();vi.restoreAllMocks();document.documentElement.classList.remove('reduceMotion');delete document.documentElement.dataset.reduceMotion
})
function Controlled({initial=80,unit='kg',disabled=false}){
 parentRenders++
 const [value,setValue]=useState(initial);setCanonical=setValue
 return <BodyWeightPicker value={value} unit={unit} disabled={disabled} onChange={next=>{changed(next);setValue(next)}}/>
}
const mount=async props=>act(()=>root.render(<Controlled {...props}/>))
const ruler=()=>host.querySelector('[role=slider]')
const field=()=>host.querySelector(`input[aria-label="${t('Weight')}"]`)
const visible=()=>Number(field().value.replace(',','.'))
const position=()=>Number(ruler().getAttribute('aria-valuenow'))
const pointer=async(type,x,y,time)=>{
 now=time;const event=new MouseEvent(type,{clientX:x,clientY:y,button:0,bubbles:true,cancelable:true})
 Object.defineProperties(event,{pointerId:{value:1},isPrimary:{value:true},timeStamp:{value:1000+time}})
 await act(()=>ruler().dispatchEvent(event))
}
const frameAt=async time=>{
 now=time;const pending=[...frames.values()];frames.clear()
 await act(()=>pending.forEach(fn=>fn(time)))
}
const flick=async(direction=1)=>{
 await pointer('pointerdown',200,30,0);await pointer('pointermove',200-30*direction,31,30);await pointer('pointerup',200-40*direction,31,50)
}
const input=async raw=>act(()=>{
 field().focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field(),raw)
 field().dispatchEvent(new Event('input',{bubbles:true}));field().blur()
})

it('coasts after a fast release, decelerates and settles on a visible tenth without storage writes',async()=>{
 await mount();await flick();expect(visible()).toBe(80.4);expect(frames.size).toBe(1)
 // Expected capture release and the bubbled pointerup must not kill the flight.
 await pointer('lostpointercapture',160,31,50);expect(frames.size).toBe(1)
 const released=position(),releasedRenders=parentRenders;await frameAt(90);const first=position();await frameAt(130);const second=position();await frameAt(170);const third=position()
 expect(first).toBeGreaterThan(released);expect(second).toBeGreaterThan(first);expect(third).toBeGreaterThan(second)
 expect(third-second).toBeLessThan(second-first)
 expect(changed).toHaveBeenCalledExactlyOnceWith(80.4);expect(parentRenders).toBe(releasedRenders)
 expect(changed.mock.calls.every(([value])=>Math.abs(value*10-Math.round(value*10))<1e-8)).toBe(true)
 await frameAt(2000);expect(frames.size).toBe(0);const final=visible(),calls=changed.mock.calls.length
 expect(final).toBeGreaterThan(80.4);expect(changed).toHaveBeenLastCalledWith(final);expect(calls).toBe(2)
 await frameAt(2300);expect(visible()).toBe(final);expect(changed).toHaveBeenCalledTimes(calls)
})

it('does not coast or drift after a deliberately slow drag or held release',async()=>{
 await mount();await pointer('pointerdown',200,30,0);await pointer('pointermove',170,30,200);await pointer('pointerup',170,30,350)
 expect(visible()).toBe(80.3);expect(changed).toHaveBeenCalledExactlyOnceWith(80.3);expect(frames.size).toBe(0)
 await frameAt(1500);expect(visible()).toBe(80.3);expect(changed).toHaveBeenCalledOnce()
})

it('coalesces a burst into one painted preview without rerendering the parent',async()=>{
 await mount();const initialRenders=parentRenders
 await pointer('pointerdown',200,30,0)
 for(let i=1;i<=30;i++)await pointer('pointermove',200-i*2,30,i)
 expect(frames.size).toBe(1);expect(visible()).toBe(80);expect(changed).not.toHaveBeenCalled()
 await frameAt(32)
 expect(visible()).toBe(80.6);expect(position()).toBe(80.6)
 expect(parentRenders).toBe(initialRenders);expect(frames.size).toBe(0)
 await pointer('pointerup',140,30,200)
 expect(changed).toHaveBeenCalledExactlyOnceWith(80.6);expect(frames.size).toBe(0)
})

it('consumes the final release point before a queued drag frame can run',async()=>{
 await mount();await pointer('pointerdown',200,30,0);await pointer('pointermove',170,30,10)
 const stale=[...frames.values()][0]
 await pointer('pointerup',150,30,30)
 expect(visible()).toBe(80.5);expect(changed).toHaveBeenCalledExactlyOnceWith(80.5);expect(frames.size).toBe(1)
 await act(()=>stale(32));expect(visible()).toBe(80.5)
 await frameAt(46);expect(position()).toBeGreaterThan(80.5);expect(changed).toHaveBeenCalledOnce()
})

it('discards an unpainted drag on cancellation and ignores its already queued callback',async()=>{
 await mount();await pointer('pointerdown',200,30,0);await pointer('pointermove',170,30,10)
 const stale=[...frames.values()][0]
 await pointer('pointercancel',170,30,15)
 expect(frames.size).toBe(0);await act(()=>stale(32))
 expect(visible()).toBe(80);expect(changed).not.toHaveBeenCalled()
})

it.each([80,660,1000])('reanchors near%s using bounded tiles without restyling retained ticks',async initial=>{
 await mount({initial,unit:'lb'})
 const rail=host.querySelector('.bodyweight-picker-ticks')
 const label=[...rail.querySelectorAll('.bodyweight-picker-tick.major>span')].find(node=>node.textContent===String(initial))
 const tick=label.parentElement,tile=tick.parentElement,before=tick.getAttribute('style'),tileBefore=tile.getAttribute('style'),mutations=[]
 const observer=new MutationObserver(records=>mutations.push(...records))
 observer.observe(rail,{attributes:true,subtree:true,attributeFilter:['style']})
 try{
  await pointer('pointerdown',200,30,0);await pointer('pointermove',430,30,10);await frameAt(20)
  expect(visible()).toBeCloseTo(initial-2.3,8)
  expect(tick.isConnected).toBe(true);expect(tick.getAttribute('style')).toBe(before)
  expect(tile.getAttribute('style')).not.toBe(tileBefore)
  expect(mutations.filter(record=>record.target.classList.contains('bodyweight-picker-tick'))).toHaveLength(0)
  expect(rail.querySelectorAll('.bodyweight-picker-tile')).toHaveLength(7)
  expect(rail.querySelectorAll('.bodyweight-picker-tick')).toHaveLength(140)
  for(const mark of rail.querySelectorAll('.bodyweight-picker-tick'))expect(parseFloat(mark.style.left)).toBeLessThanOrEqual(190)
  for(const group of rail.children)expect(Math.abs(Number(group.style.left.match(/(-?\d+)px/)[1]))).toBeLessThanOrEqual(600)
  expect(Math.abs(Number(rail.style.transform.match(/translate3d\(([-\d.]+)px/)[1]))).toBeLessThan(200)
  expect(changed).not.toHaveBeenCalled()
 }finally{observer.disconnect()}
 await pointer('pointercancel',430,30,30)
})

it.each([[299.8,1,300],[1.2,-1,1]])('stops a flick from %s at its bound without overshooting',async(initial,direction,boundary)=>{
 await mount({initial});await flick(direction);await frameAt(90)
 expect(visible()).toBe(boundary);expect(frames.size).toBe(0)
 expect(changed.mock.calls.every(([value])=>value>=1&&value<=300)).toBe(true)
})

it('animates pounds locally and emits the settled value in the configured unit',async()=>{
 await mount({unit:'lb',initial:176.4});await flick();await frameAt(90)
 expect(changed).toHaveBeenCalledExactlyOnceWith(176.8);expect(visible()).toBeGreaterThan(176.8)
 expect(ruler().getAttribute('aria-valuetext')).toMatch(/ lb$/)
 await frameAt(2000);expect(changed).toHaveBeenLastCalledWith(visible());expect(changed).toHaveBeenCalledTimes(2)
 expect(changed.mock.calls.every(([value])=>Math.abs(value*10-Math.round(value*10))<1e-7)).toBe(true)
})

it.each(['new drag','canonical unit prop','typing','keyboard','outside pointer','window blur','hidden','disabled','external value','OS reduced motion','app reduced motion'])('interrupts a flight for %s and rejects an already queued old frame',async reason=>{
 await mount();await flick();await frameAt(90);expect(frames.size).toBe(1)
 const stale=[...frames.values()][0],beforeExternalCalls=changed.mock.calls.length,beforeExternalValue=visible()
 if(reason==='new drag')await pointer('pointerdown',100,30,100)
 if(reason==='canonical unit prop')await mount({unit:'lb'})
 if(reason==='typing')await input('90')
 if(reason==='keyboard')await act(()=>ruler().dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true})))
 if(reason==='outside pointer'){
  const painted=Number((visible()-.1).toFixed(1))
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field(),String(painted))
  await act(()=>host.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true})))
  expect(visible()).toBe(painted);expect(changed.mock.calls.at(-1)[0]).toBe(painted)
 }
 if(reason==='window blur')await act(()=>window.dispatchEvent(new Event('blur')))
 if(reason==='hidden'){
  vi.spyOn(document,'hidden','get').mockReturnValue(true)
  await act(()=>document.dispatchEvent(new Event('visibilitychange')))
 }
 if(reason==='disabled')await mount({disabled:true})
 if(reason==='external value')await act(()=>setCanonical(90))
 if(reason==='OS reduced motion')await act(()=>{media.matches=true;listeners.forEach(fn=>fn(new Event('change')))})
 if(reason==='app reduced motion')await act(async()=>{document.documentElement.dataset.reduceMotion='true';await Promise.resolve()})
 if(['canonical unit prop','disabled','external value'].includes(reason))expect(changed).toHaveBeenCalledTimes(beforeExternalCalls)
 if(reason==='external value')expect(visible()).toBe(90)
 if(reason==='disabled'){
  expect(field().disabled).toBe(true);expect(visible()).toBe(beforeExternalValue)
  await mount({disabled:false});await input('invalid')
  expect(field().value).toBe('invalid');expect(field().getAttribute('aria-invalid')).toBe('true');expect(host.querySelector('[role=alert]')).not.toBeNull()
 }
 if(reason==='canonical unit prop'){
  expect(ruler().getAttribute('aria-valuetext')).toMatch(/ lb$/);expect(visible()).toBe(beforeExternalValue)
 }
 const stopped=visible(),calls=changed.mock.calls.length
 expect(frames.size).toBe(0);now=1000;await act(()=>stale(1000));await frameAt(1100)
 expect(visible()).toBe(stopped);expect(changed).toHaveBeenCalledTimes(calls)
})

it('cancels the scheduled frame on unmount without a later callback or saved record',async()=>{
 await mount();await flick();await frameAt(90);const stale=[...frames.values()][0],calls=changed.mock.calls.length
 await act(()=>root.unmount());root=null;expect(frames.size).toBe(0)
 now=1000;await act(()=>stale(1000));expect(changed).toHaveBeenCalledTimes(calls)
})

it('focuses and selects the complete localized painted value when the moving draft is one tick ahead',async()=>{
 await setLang('es');await mount({unit:'lb',initial:181});await flick();await frameAt(90)
 expect(visible()).toBe(181.7);const stale=[...frames.values()][0]
 // Model an already-painted DOM tenth while the parent has a newer RAF draft.
 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field(),'181,6')
 await act(()=>field().focus())
 expect(field().value).toBe('181,6');expect(changed.mock.calls.at(-1)[0]).toBe(181.6)
 expect(field().selectionStart).toBe(0);expect(field().selectionEnd).toBe(field().value.length)
 expect(frames.size).toBe(0);now=1000;await act(()=>stale(1000))
 expect(field().value).toBe('181,6')
})

it('continues a new drag from the painted value when the preceding flight had a newer queued draft',async()=>{
 await mount({initial:181});await flick();await frameAt(90)
 expect(visible()).toBe(181.7)
 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field(),'181.6')
 await pointer('pointerdown',200,30,100)
 expect(visible()).toBe(181.6)
 await pointer('pointermove',170,30,130);await frameAt(146);expect(visible()).toBe(181.9)
 await pointer('pointerup',170,30,350)
 expect(visible()).toBe(181.9);expect(frames.size).toBe(0)
 expect(changed.mock.calls.at(-1)[0]).toBe(181.9)
})

it('applies the next keyboard tenth after freezing an older painted value',async()=>{
 await mount({initial:181});await flick();await frameAt(90)
 expect(visible()).toBe(181.7)
 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field(),'181.6')
 await act(()=>ruler().dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true})))
 expect(visible()).toBe(181.7);expect(changed.mock.calls.at(-1)[0]).toBe(181.7);expect(frames.size).toBe(0)
})

it.each(['OS','app'])('respects an existing %s reduced-motion preference at release',async kind=>{
 if(kind==='OS')media.matches=true;else document.documentElement.dataset.reduceMotion='true'
 await mount();await flick();expect(visible()).toBe(80.4);expect(frames.size).toBe(0)
 await frameAt(1000);expect(visible()).toBe(80.4);expect(changed).toHaveBeenCalledExactlyOnceWith(80.4)
})

it('travels farther after a stronger flick while both flights remain unsaved local drafts',async()=>{
 const travel=async(name,distance,duration)=>{
  await act(()=>root.render(<Controlled key={name}/>))
  await pointer('pointerdown',200,30,0);await pointer('pointermove',200-distance/2,30,duration/2);await pointer('pointerup',200-distance,30,duration)
  expect(frames.size).toBe(1);const released=visible()
  await frameAt(duration+2000);expect(frames.size).toBe(0)
  return visible()-released
 }
 const gentle=await travel('gentle',45,100) // .45 CSS px/ms.
 const strong=await travel('strong',60,50) // 1.2 CSS px/ms.
 expect(gentle).toBeGreaterThan(0);expect(strong).toBeGreaterThan(gentle)
 expect(localStorage.getItem('gym_state_v1')).toBeNull()
})
